import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
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
  CreateWorkspaceDto,
  LeaveWorkspaceResponseDto,
  UpdateWorkspaceDto,
  WorkspaceInvitePreviewResponseDto,
  WorkspaceListResponseDto,
  WorkspaceMembersResponseDto,
  WorkspaceResponseDto,
  WorkspaceSummaryResponseDto,
} from "./workspace.dto";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceRoles } from "./workspace-access.decorator";
import { WorkspaceAccessGuard } from "./workspace-access.guard";

@Controller("workspaces")
@ApiTags("Workspaces")
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspaceService: WorkspaceService) {}

  @Post()
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "createWorkspace", summary: "Create a workspace" })
  @ApiBody({ type: CreateWorkspaceDto })
  @ApiCreatedResponse({ type: WorkspaceResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  async createWorkspace(@Body() body: CreateWorkspaceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.createWorkspace(user, body);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "listWorkspaces", summary: "List accessible workspaces" })
  @ApiOkResponse({ type: WorkspaceListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async listWorkspaces(@CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.listWorkspaces(user);
  }

  @Get(":workspaceId")
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "getWorkspace", summary: "Get workspace details" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getWorkspace(@Param("workspaceId") workspaceId: string) {
    return this.workspaceService.getWorkspace(workspaceId);
  }

  @Get(":workspaceId/summary")
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "getWorkspaceSummary", summary: "Get workspace summary" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: WorkspaceSummaryResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getWorkspaceSummary(@Param("workspaceId") workspaceId: string) {
    return this.workspaceService.getWorkspaceSummary(workspaceId);
  }

  @Get(":workspaceId/members")
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "getWorkspaceMembers", summary: "Get workspace members" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: WorkspaceMembersResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getWorkspaceMembers(@Param("workspaceId") workspaceId: string) {
    return this.workspaceService.getWorkspaceMembers(workspaceId);
  }

  @Patch(":workspaceId")
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @WorkspaceRoles(WORKSPACE_ROLES.ADMIN)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "updateWorkspace", summary: "Update a workspace" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: UpdateWorkspaceDto })
  @ApiOkResponse({ type: WorkspaceResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  async updateWorkspace(@Param("workspaceId") workspaceId: string, @Body() body: UpdateWorkspaceDto) {
    return this.workspaceService.updateWorkspace(workspaceId, body);
  }

  @Delete(":workspaceId")
  @HttpCode(204)
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @WorkspaceRoles(WORKSPACE_ROLES.OWNER)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "deleteWorkspace", summary: "Delete a workspace" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteWorkspace(@Param("workspaceId") workspaceId: string) {
    await this.workspaceService.deleteWorkspace(workspaceId);
  }

  @Post(":workspaceId/leave")
  @HttpCode(200)
  @UseGuards(AuthGuard, WorkspaceAccessGuard)
  @ApiCookieAuth(AUTH_COOKIE_NAME)
  @ApiOperation({ operationId: "leaveWorkspace", summary: "Leave a workspace" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: LeaveWorkspaceResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async leaveWorkspace(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.workspaceService.leaveWorkspace(workspaceId, user);
  }

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
