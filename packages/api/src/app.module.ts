import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccountsModule } from "./accounts/accounts.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AppController } from "./app.controller";
import { AuthModule } from "./auth/auth.module";
import { CategoriesModule } from "./categories/categories.module";
import { DebtsModule } from "./debts/debts.module";
import { TransactionsModule } from "./transactions/transactions.module";
import { WorkspaceModule } from "./workspace/workspace.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    WorkspaceModule,
    AccountsModule,
    CategoriesModule,
    DebtsModule,
    TransactionsModule,
    AnalyticsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
