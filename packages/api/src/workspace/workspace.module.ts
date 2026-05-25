import { Module } from "@nestjs/common";

import { AuthModule } from "@/auth/auth.module";
import { EmailModule } from "@/email/email.module";
import { PrismaModule } from "@/prisma/prisma.module";

import { WorkspaceController, WorkspaceInvitesController } from "./workspace.controller";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceAccessGuard } from "./workspace-access.guard";

@Module({
  imports: [AuthModule, EmailModule, PrismaModule],
  controllers: [WorkspaceController, WorkspaceInvitesController],
  providers: [WorkspaceService, WorkspaceAccessGuard],
  exports: [WorkspaceService, WorkspaceAccessGuard],
})
export class WorkspaceModule {}
