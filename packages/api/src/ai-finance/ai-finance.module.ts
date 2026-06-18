import { Module } from "@nestjs/common";

import { CurrencyModule } from "@/currency/currency.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { TransactionsModule } from "@/transactions/transactions.module";

import { AiFinanceService } from "./ai-finance.service";
import { AiFinanceCommitService } from "./ai-finance-commit.service";
import { AiFinanceDraftService } from "./ai-finance-draft.service";
import { AiFinanceParserService } from "./ai-finance-parser.service";
import { AiFinancePreferenceService } from "./ai-finance-preference.service";
import { AiFinancePreviewService } from "./ai-finance-preview.service";
import { AiFinanceResolverService } from "./ai-finance-resolver.service";
import { OpenRouterClient } from "./openrouter.client";

@Module({
  imports: [CurrencyModule, PrismaModule, TransactionsModule],
  providers: [
    AiFinanceCommitService,
    AiFinanceDraftService,
    AiFinanceParserService,
    AiFinancePreferenceService,
    AiFinancePreviewService,
    AiFinanceResolverService,
    AiFinanceService,
    OpenRouterClient,
  ],
  exports: [AiFinanceDraftService, AiFinancePreferenceService, AiFinanceService, OpenRouterClient],
})
export class AiFinanceModule {}
