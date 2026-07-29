import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { PrismaService } from "@/prisma/prisma.service";
import { runSerializableTransaction } from "@/prisma/serializable-transaction";
import { TransactionsService } from "@/transactions/transactions.service";

import {
  AI_DRAFT_COMMITTED,
  AI_DRAFT_COMMITTING,
  AI_DRAFT_READY,
  type AiFinanceDraftPayload,
} from "./ai-finance.types";
import { AiFinanceDraftService } from "./ai-finance-draft.service";

type AiFinanceCommitResponse = {
  draftId: string;
  createdPaymentTransactionIds: string[];
  createdTransferTransactionId?: string;
};

type AiFinanceCommitOutcome =
  | { kind: "notFound" | "committing" | "notReady" }
  | { kind: "committed" | "created"; response: AiFinanceCommitResponse };

@Injectable()
export class AiFinanceCommitService {
  constructor(
    @Inject(AiFinanceDraftService) private readonly drafts: AiFinanceDraftService,
    @Inject(TransactionsService) private readonly transactions: TransactionsService,
    @Inject(PrismaService) private readonly prisma: PrismaService
  ) {}

  async commitDraft(draftId: string, user: AuthenticatedUser) {
    let outcome: AiFinanceCommitOutcome;
    try {
      outcome = await runSerializableTransaction(this.prisma, async (tx) => {
        const draft = await this.drafts.reserveReadyDraftForCommit(draftId, user.id, tx);
        if (!draft) {
          const existingDraft = await this.drafts.findDraft(draftId, user.id, tx);
          if (!existingDraft) return { kind: "notFound" as const };

          const existingPayload = this.drafts.parsePayload(existingDraft);
          if (existingDraft.status === AI_DRAFT_COMMITTED) {
            return {
              kind: "committed" as const,
              response: {
                draftId,
                createdPaymentTransactionIds: existingPayload.createdPaymentTransactionIds ?? [],
                createdTransferTransactionId: existingPayload.createdTransferTransactionId ?? undefined,
              },
            };
          }

          if (existingDraft.status === AI_DRAFT_COMMITTING) return { kind: "committing" as const };
          return { kind: "notReady" as const };
        }

        const payload = this.drafts.parsePayload(draft);

        if (!draft.workspaceId || (!payload.entries?.length && !payload.transfer)) {
          throw new BadRequestException("Черновик нельзя создать без рабочей области и записей");
        }

        if (payload.transfer) {
          const transfer = payload.transfer;
          if (!transfer.fromAccountId || !transfer.toAccountId || !transfer.date) {
            throw new BadRequestException("Черновик содержит неполный перевод");
          }

          const result = await this.transactions.createTransferTransaction(
            draft.workspaceId,
            {
              fromAccountId: transfer.fromAccountId,
              toAccountId: transfer.toAccountId,
              amount: transfer.amount,
              toAmount: transfer.toAmount,
              description: transfer.description ?? undefined,
              date: new Date(transfer.date),
            },
            user,
            { createdByAi: true, transactionClient: tx }
          );
          const nextPayload: AiFinanceDraftPayload = {
            ...payload,
            createdTransferTransactionId: result.transfer.id,
          };
          await this.drafts.markCommitted(draftId, nextPayload, tx);
          return {
            kind: "created" as const,
            response: { draftId, createdPaymentTransactionIds: [], createdTransferTransactionId: result.transfer.id },
          };
        }

        const inputs = (payload.entries ?? []).map((entry) => {
          if (!entry.accountId || !entry.date) {
            throw new BadRequestException("Черновик содержит неполные записи");
          }

          return {
            accountId: entry.accountId,
            amount: entry.amount,
            type: entry.type,
            description: entry.description ?? undefined,
            date: new Date(entry.date),
            categoryId: entry.categoryId ?? undefined,
          };
        });

        const result = await this.transactions.createPaymentTransactionsBatch(draft.workspaceId, inputs, user, {
          createdByAi: true,
          transactionClient: tx,
        });
        const nextPayload: AiFinanceDraftPayload = {
          ...payload,
          createdPaymentTransactionIds: result.transactions.map((transaction) => transaction.id),
        };
        await this.drafts.markCommitted(draftId, nextPayload, tx);
        return {
          kind: "created" as const,
          response: { draftId, createdPaymentTransactionIds: nextPayload.createdPaymentTransactionIds ?? [] },
        };
      });
    } catch (error) {
      await this.markFailedAfterRollback(draftId, user.id, error).catch(() => undefined);
      throw error;
    }

    if (outcome.kind === "notFound") {
      throw new NotFoundException("Черновик не найден или устарел");
    }
    if (outcome.kind === "committing") {
      throw new BadRequestException("Черновик уже создаётся. Подождите пару секунд.");
    }
    if (outcome.kind === "notReady") {
      throw new BadRequestException("Черновик ещё не готов к созданию");
    }

    if ("response" in outcome) {
      return outcome.response;
    }

    throw new BadRequestException("Черновик ещё не готов к созданию");
  }

  private async markFailedAfterRollback(draftId: string, userId: string, error: unknown) {
    const failedDraft = await this.drafts.findDraft(draftId, userId);
    if (!failedDraft || ![AI_DRAFT_READY, AI_DRAFT_COMMITTING].includes(failedDraft.status)) return;

    const failedPayload = this.drafts.parsePayload(failedDraft);
    await this.drafts.markFailedIfReady(draftId, {
      ...failedPayload,
      error: error instanceof Error ? error.message : "Commit failed",
    });
  }
}
