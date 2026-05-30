import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "@/auth/auth.guard";
import type { AuthenticatedUser } from "@/auth/auth.types";
import { CurrentUser } from "@/auth/current-user.decorator";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";

import {
  AccountListResponseDto,
  AccountResponseDto,
  AccountSuccessResponseDto,
  ArchivedAccountListResponseDto,
  CreateAccountDto,
  UpdateAccountDto,
  UpdateAccountsOrderDto,
} from "./accounts.dto";
import { AccountsService } from "./accounts.service";

@Controller()
@ApiTags("Accounts")
@UseGuards(AuthGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
export class AccountsController {
  constructor(@Inject(AccountsService) private readonly accountsService: AccountsService) {}

  @Post("workspaces/:workspaceId/accounts")
  @ApiOperation({ operationId: "createAccount", summary: "Create an account" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateAccountDto })
  @ApiCreatedResponse({ type: AccountResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createAccount(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateAccountDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.accountsService.createAccount(workspaceId, body, user);
  }

  @Get("workspaces/:workspaceId/accounts")
  @ApiOperation({ operationId: "listAccounts", summary: "List active accounts" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: AccountListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listAccounts(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.listAccounts(workspaceId, user);
  }

  @Get("workspaces/:workspaceId/accounts/archived")
  @ApiOperation({ operationId: "listArchivedAccounts", summary: "List archived accounts" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiOkResponse({ type: ArchivedAccountListResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listArchivedAccounts(@Param("workspaceId") workspaceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.listArchivedAccounts(workspaceId, user);
  }

  @Patch("workspaces/:workspaceId/accounts/order")
  @ApiOperation({ operationId: "updateAccountsOrder", summary: "Update account order" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: UpdateAccountsOrderDto })
  @ApiOkResponse({ type: AccountSuccessResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateAccountsOrder(
    @Param("workspaceId") workspaceId: string,
    @Body() body: UpdateAccountsOrderDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.accountsService.updateAccountsOrder(workspaceId, body, user);
  }

  @Get("accounts/:accountId")
  @ApiOperation({ operationId: "getAccount", summary: "Get an account" })
  @ApiParam({ name: "accountId", type: String })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getAccount(@Param("accountId") accountId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.getAccount(accountId, user);
  }

  @Patch("accounts/:accountId")
  @ApiOperation({ operationId: "updateAccount", summary: "Update an account" })
  @ApiParam({ name: "accountId", type: String })
  @ApiBody({ type: UpdateAccountDto })
  @ApiOkResponse({ type: AccountResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateAccount(
    @Param("accountId") accountId: string,
    @Body() body: UpdateAccountDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.accountsService.updateAccount(accountId, body, user);
  }

  @Post("accounts/:accountId/archive")
  @HttpCode(200)
  @ApiOperation({ operationId: "archiveAccount", summary: "Archive an account" })
  @ApiParam({ name: "accountId", type: String })
  @ApiOkResponse({ type: AccountSuccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async archiveAccount(@Param("accountId") accountId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.archiveAccount(accountId, user);
  }

  @Post("accounts/:accountId/unarchive")
  @HttpCode(200)
  @ApiOperation({ operationId: "unarchiveAccount", summary: "Restore an archived account" })
  @ApiParam({ name: "accountId", type: String })
  @ApiOkResponse({ type: AccountSuccessResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async unarchiveAccount(@Param("accountId") accountId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.accountsService.unarchiveAccount(accountId, user);
  }

  @Delete("accounts/:accountId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteArchivedAccount", summary: "Delete an archived account" })
  @ApiParam({ name: "accountId", type: String })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteArchivedAccount(@Param("accountId") accountId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.accountsService.deleteArchivedAccount(accountId, user);
  }
}
