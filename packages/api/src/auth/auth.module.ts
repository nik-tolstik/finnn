import { Module } from "@nestjs/common";

import { EmailModule } from "@/email/email.module";
import { PrismaModule } from "@/prisma/prisma.module";

import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Module({
  imports: [EmailModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
