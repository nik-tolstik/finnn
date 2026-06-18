import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AiFinanceDraft, Prisma } from "@prisma/client";

import { PrismaService } from "@/prisma/prisma.service";

import {
  AI_DRAFT_CANCELLED,
  AI_DRAFT_COMMITTED,
  AI_DRAFT_COMMITTING,
  AI_DRAFT_EXPIRED,
  AI_DRAFT_FAILED,
  AI_DRAFT_PENDING,
  AI_DRAFT_READY,
  type AiDraftStatus,
  type AiFinanceDraftPayload,
  type AiFinanceQuestion,
  type AiFinanceSourceType,
} from "./ai-finance.types";

const ACTIVE_DRAFT_STATUSES = [AI_DRAFT_PENDING, AI_DRAFT_READY];

function getDraftTtlSeconds(): number {
  const value = Number(process.env.TELEGRAM_BOT_DRAFT_TTL_SECONDS || "1800");
  return Number.isFinite(value) && value > 0 ? value : 1800;
}

function getExpiresAt(now = new Date()) {
  return new Date(now.getTime() + getDraftTtlSeconds() * 1000);
}

function toJsonPayload(payload: AiFinanceDraftPayload): Prisma.InputJsonValue {
  return payload as unknown as Prisma.InputJsonValue;
}

@Injectable()
export class AiFinanceDraftService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async findActiveDraft(userId: string, telegramChatId?: string | null) {
    return this.prisma.aiFinanceDraft.findFirst({
      where: {
        userId,
        telegramChatId: telegramChatId ?? undefined,
        status: { in: ACTIVE_DRAFT_STATUSES },
        expiresAt: { gt: new Date() },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getActiveDraftOrThrow(draftId: string, userId: string) {
    const draft = await this.prisma.aiFinanceDraft.findFirst({
      where: {
        id: draftId,
        userId,
        status: { in: ACTIVE_DRAFT_STATUSES },
        expiresAt: { gt: new Date() },
      },
    });

    if (!draft) {
      throw new NotFoundException("Черновик не найден или устарел");
    }

    return draft;
  }

  async findDraft(draftId: string, userId: string) {
    return this.prisma.aiFinanceDraft.findFirst({
      where: { id: draftId, userId },
    });
  }

  async createDraft(input: {
    userId: string;
    telegramChatId?: string;
    workspaceId?: string | null;
    sourceType: AiFinanceSourceType;
    sourceText?: string;
    receiptMode?: string | null;
    kind?: string | null;
    payload: AiFinanceDraftPayload;
    missingFields: string[];
    confidence?: number | null;
    currentQuestion?: AiFinanceQuestion | null;
  }) {
    return this.prisma.aiFinanceDraft.create({
      data: {
        userId: input.userId,
        telegramChatId: input.telegramChatId,
        workspaceId: input.workspaceId ?? null,
        sourceType: input.sourceType,
        sourceText: input.sourceText,
        receiptMode: input.receiptMode,
        kind: input.kind,
        payload: toJsonPayload(input.payload),
        missingFields: input.missingFields,
        confidence: input.confidence,
        currentQuestion: input.currentQuestion,
        status: input.missingFields.length > 0 ? AI_DRAFT_PENDING : AI_DRAFT_READY,
        expiresAt: getExpiresAt(),
      },
    });
  }

  async updateDraft(
    draftId: string,
    userId: string,
    input: {
      workspaceId?: string | null;
      receiptMode?: string | null;
      payload?: AiFinanceDraftPayload;
      missingFields?: string[];
      currentQuestion?: AiFinanceQuestion | null;
      status?: AiDraftStatus;
    }
  ) {
    await this.getActiveDraftOrThrow(draftId, userId);

    const missingFields = input.missingFields;
    const status = input.status ?? (missingFields && missingFields.length === 0 ? AI_DRAFT_READY : undefined);

    return this.prisma.aiFinanceDraft.update({
      where: { id: draftId },
      data: {
        workspaceId: input.workspaceId,
        receiptMode: input.receiptMode,
        payload: input.payload ? toJsonPayload(input.payload) : undefined,
        missingFields,
        currentQuestion: input.currentQuestion,
        status,
        expiresAt: getExpiresAt(),
      },
    });
  }

  async cancelActiveDraft(userId: string, telegramChatId?: string | null) {
    const draft = await this.findActiveDraft(userId, telegramChatId);
    if (!draft) {
      return null;
    }

    return this.prisma.aiFinanceDraft.update({
      where: { id: draft.id },
      data: { status: AI_DRAFT_CANCELLED, currentQuestion: null },
    });
  }

  async markCommitted(draftId: string, payload: AiFinanceDraftPayload) {
    return this.prisma.aiFinanceDraft.update({
      where: { id: draftId },
      data: {
        status: AI_DRAFT_COMMITTED,
        payload: toJsonPayload(payload),
        currentQuestion: null,
        committedAt: new Date(),
      },
    });
  }

  async reserveReadyDraftForCommit(draftId: string, userId: string) {
    const result = await this.prisma.aiFinanceDraft.updateMany({
      where: {
        id: draftId,
        userId,
        status: AI_DRAFT_READY,
        expiresAt: { gt: new Date() },
      },
      data: {
        status: AI_DRAFT_COMMITTING,
      },
    });

    if (result.count !== 1) {
      return null;
    }

    return this.findDraft(draftId, userId);
  }

  async markFailed(draftId: string, payload: AiFinanceDraftPayload) {
    return this.prisma.aiFinanceDraft.update({
      where: { id: draftId },
      data: {
        status: AI_DRAFT_FAILED,
        payload: toJsonPayload(payload),
        currentQuestion: null,
      },
    });
  }

  async expireStaleDrafts() {
    return this.prisma.aiFinanceDraft.updateMany({
      where: {
        status: { in: ACTIVE_DRAFT_STATUSES },
        expiresAt: { lte: new Date() },
      },
      data: {
        status: AI_DRAFT_EXPIRED,
        currentQuestion: null,
      },
    });
  }

  parsePayload(draft: Pick<AiFinanceDraft, "payload">): AiFinanceDraftPayload {
    return draft.payload as unknown as AiFinanceDraftPayload;
  }
}
