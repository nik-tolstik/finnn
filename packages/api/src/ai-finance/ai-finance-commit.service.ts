import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { TransactionsService } from "@/transactions/transactions.service";

import { AI_DRAFT_COMMITTED, AI_DRAFT_COMMITTING, type AiFinanceDraftPayload } from "./ai-finance.types";
import { AiFinanceDraftService } from "./ai-finance-draft.service";

@Injectable()
export class AiFinanceCommitService {
  constructor(
    @Inject(AiFinanceDraftService) private readonly drafts: AiFinanceDraftService,
    @Inject(TransactionsService) private readonly transactions: TransactionsService
  ) {}

  async commitDraft(draftId: string, user: AuthenticatedUser) {
    const draft = await this.drafts.reserveReadyDraftForCommit(draftId, user.id);
    if (!draft) {
      const existingDraft = await this.drafts.findDraft(draftId, user.id);
      if (!existingDraft) {
        throw new NotFoundException("Черновик не найден или устарел");
      }

      const existingPayload = this.drafts.parsePayload(existingDraft);
      if (existingDraft.status === AI_DRAFT_COMMITTED) {
        return {
          draftId,
          createdPaymentTransactionIds: existingPayload.createdPaymentTransactionIds ?? [],
          createdTransferTransactionId: existingPayload.createdTransferTransactionId ?? undefined,
        };
      }

      if (existingDraft.status === AI_DRAFT_COMMITTING) {
        throw new BadRequestException("Черновик уже создаётся. Подождите пару секунд.");
      }

      throw new BadRequestException("Черновик ещё не готов к созданию");
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

      try {
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
          user
        );
        const nextPayload: AiFinanceDraftPayload = {
          ...payload,
          createdTransferTransactionId: result.transfer.id,
        };
        await this.drafts.markCommitted(draftId, nextPayload);
        return { draftId, createdPaymentTransactionIds: [], createdTransferTransactionId: result.transfer.id };
      } catch (error) {
        await this.drafts.markFailed(draftId, {
          ...payload,
          error: error instanceof Error ? error.message : "Commit failed",
        });
        throw error;
      }
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

    try {
      const result = await this.transactions.createPaymentTransactionsBatch(draft.workspaceId, inputs, user);
      const nextPayload: AiFinanceDraftPayload = {
        ...payload,
        createdPaymentTransactionIds: result.transactions.map((transaction) => transaction.id),
      };
      await this.drafts.markCommitted(draftId, nextPayload);
      return { draftId, createdPaymentTransactionIds: nextPayload.createdPaymentTransactionIds ?? [] };
    } catch (error) {
      await this.drafts.markFailed(draftId, {
        ...payload,
        error: error instanceof Error ? error.message : "Commit failed",
      });
      throw error;
    }
  }
}
