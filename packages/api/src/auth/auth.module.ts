import { Module } from "@nestjs/common";

import { AvatarModule } from "@/avatar/avatar.module";
import { EmailModule } from "@/email/email.module";
import { PrismaModule } from "@/prisma/prisma.module";

import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { TelegramOidcClient } from "./telegram-oidc.client";

@Module({
  imports: [AvatarModule, EmailModule, PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, TelegramOidcClient],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
