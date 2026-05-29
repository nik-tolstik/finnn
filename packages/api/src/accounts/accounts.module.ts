import { Module } from "@nestjs/common";

import { AuthModule } from "@/auth/auth.module";
import { PrismaModule } from "@/prisma/prisma.module";

import { AccountsController } from "./accounts.controller";
import { AccountsService } from "./accounts.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
