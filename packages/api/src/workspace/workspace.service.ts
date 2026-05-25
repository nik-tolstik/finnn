import { randomBytes } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthenticatedUser } from "@/auth/auth.types";
import { EmailService } from "@/email/email.service";
import { PrismaService } from "@/prisma/prisma.service";

import type { CreateInviteDto } from "./workspace.dto";

const INVITE_TOKEN_BYTES = 32;

function getInviteExpiryDate(expiresInDays: number): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  return expiresAt;
}

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  async createInvite(workspaceId: string, input: CreateInviteDto) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    if (!workspace) {
      throw new NotFoundException("Рабочий стол не найден");
    }

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (!user) {
      throw new BadRequestException("Пользователь с таким email не зарегистрирован");
    }

    const existingMember = await this.prisma.workspaceMember.findFirst({
      where: {
        workspaceId,
        userId: user.id,
      },
    });

    if (existingMember) {
      throw new ConflictException("Пользователь уже является участником этого рабочего стола");
    }

    const invite = await this.prisma.workspaceInvite.create({
      data: {
        workspaceId,
        email: input.email,
        token: randomBytes(INVITE_TOKEN_BYTES).toString("hex"),
        expiresAt: getInviteExpiryDate(input.expiresInDays),
      },
    });

    const emailResult = await this.emailService.sendInviteEmail(invite.email, invite.token, workspace.name);

    if ("error" in emailResult) {
      await this.prisma.workspaceInvite.delete({
        where: { id: invite.id },
      });
      throw new ServiceUnavailableException(`Не удалось отправить приглашение: ${emailResult.error}`);
    }

    return { invite };
  }

  async getInvite(token: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invite) {
      throw new BadRequestException("Приглашение не найдено");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException("Приглашение истекло");
    }

    return {
      invite: {
        email: invite.email,
        workspaceName: invite.workspace.name,
        workspaceId: invite.workspace.id,
        expiresAt: invite.expiresAt,
      },
    };
  }

  async acceptInvite(token: string, currentUser: AuthenticatedUser) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { token },
      include: { workspace: true },
    });

    if (!invite) {
      throw new BadRequestException("Неверный токен приглашения");
    }

    if (invite.expiresAt < new Date()) {
      throw new BadRequestException("Приглашение истекло");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: currentUser.id },
      select: { email: true },
    });

    if (!user?.email) {
      throw new UnauthorizedException("Не авторизован");
    }

    if (invite.email !== user.email) {
      throw new ForbiddenException("Email приглашения не совпадает с вашим аккаунтом");
    }

    const existingMember = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: invite.workspaceId,
          userId: currentUser.id,
        },
      },
    });

    if (existingMember) {
      throw new ConflictException("Вы уже являетесь участником этого рабочего стола");
    }

    await this.prisma.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: currentUser.id,
        role: "member",
      },
    });

    await this.prisma.workspaceInvite.delete({
      where: { id: invite.id },
    });

    return { success: true, workspaceId: invite.workspaceId };
  }
}
