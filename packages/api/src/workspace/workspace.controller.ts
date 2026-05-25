import { Body, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "@/auth/auth.guard";
import type { AuthenticatedUser } from "@/auth/auth.types";
import { CurrentUser } from "@/auth/current-user.decorator";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";

import { WORKSPACE_ROLES } from "./workspace.constants";
import {
  AcceptInviteResponseDto,
  CreateInviteDto,
  CreateInviteResponseDto,
  WorkspaceInvitePreviewResponseDto,
} from "./workspace.dto";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceRoles } from "./workspace-access.decorator";
import { WorkspaceAccessGuard } from "./workspace-access.guard";

@Controller("workspaces")
@ApiTags("Workspaces")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspaceService: WorkspaceService) {}

  @Post(":workspaceId/invites")
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @WorkspaceRoles(WORKSPACE_ROLES.ADMIN)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "createWorkspaceInvite", summary: "Create a workspace invite" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateInviteDto })
  @ApiCreatedResponse({ type: CreateInviteResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async createInvite(@Param("workspaceId") workspaceId: string, @Body() body: CreateInviteDto) {
    return this.workspaceService.createInvite(workspaceId, body);
  }
}

@Controller("workspace-invites")
@ApiTags("Workspace Invites")
export class WorkspaceInvitesController {
  constructor(@Inject(WorkspaceService) private readonly workspaceService: WorkspaceService) {}

  @Get(":token")
  @ApiOperation({ operationId: "getWorkspaceInvite", summary: "Preview a workspace invite" })
  @ApiParam({ name: "token", type: String })
  @ApiOkResponse({ type: WorkspaceInvitePreviewResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  async getInvite(@Param("token") token: string) {
    return this.workspaceService.getInvite(token);
  }

  @Post(":token/accept")
  @HttpCode(200)
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "acceptWorkspaceInvite", summary: "Accept a workspace invite" })
  @ApiParam({ name: "token", type: String })
  @ApiOkResponse({ type: AcceptInviteResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  async acceptInvite(@Param("token") token: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.acceptInvite(token, user);
  }
}
