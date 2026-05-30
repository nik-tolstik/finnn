import { Module } from "@nestjs/common";

import { AuthModule } from "@/auth/auth.module";
import { CurrencyModule } from "@/currency/currency.module";
import { PrismaModule } from "@/prisma/prisma.module";
import { WorkspaceModule } from "@/workspace/workspace.module";

import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";

@Module({
  imports: [AuthModule, PrismaModule, WorkspaceModule, CurrencyModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
