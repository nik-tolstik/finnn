import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
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
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "@/auth/auth.guard";
import type { AuthenticatedUser } from "@/auth/auth.types";
import { CurrentUser } from "@/auth/current-user.decorator";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";

import {
  AddToDebtDto,
  CloseDebtDto,
  CreateDebtDto,
  DebtEditDataResponseDto,
  type DebtListQueryDto,
  DebtListResponseDto,
  DebtResponseDto,
  DebtTransactionResponseDto,
  UpdateDebtDto,
  UpdateDebtEntryTransactionDto,
} from "./debts.dto";
import { DebtsService } from "./debts.service";

@Controller()
@ApiTags("Debts")
@UseGuards(AuthGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
export class DebtsController {
  constructor(@Inject(DebtsService) private readonly debtsService: DebtsService) {}

  @Get("workspaces/:workspaceId/debts")
  @ApiOperation({ operationId: "listDebts", summary: "List debts" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ name: "status", required: false, type: String })
  @ApiQuery({ name: "type", required: false, type: String })
  @ApiQuery({ name: "personName", required: false, type: String })
  @ApiOkResponse({ type: DebtListResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listDebts(
    @Param("workspaceId") workspaceId: string,
    @Query() query: DebtListQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.debtsService.listDebts(workspaceId, query, user);
  }

  @Post("workspaces/:workspaceId/debts")
  @ApiOperation({ operationId: "createDebt", summary: "Create a debt" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateDebtDto })
  @ApiCreatedResponse({ type: DebtResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createDebt(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateDebtDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.debtsService.createDebt(workspaceId, body, user);
  }

  @Get("debts/:debtId/edit-data")
  @ApiOperation({ operationId: "getDebtEditData", summary: "Get debt edit data" })
  @ApiParam({ name: "debtId", type: String })
  @ApiOkResponse({ type: DebtEditDataResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getDebtEditData(@Param("debtId") debtId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.debtsService.getDebtEditData(debtId, user);
  }

  @Patch("debts/:debtId")
  @ApiOperation({ operationId: "updateDebt", summary: "Update a debt" })
  @ApiParam({ name: "debtId", type: String })
  @ApiBody({ type: UpdateDebtDto })
  @ApiOkResponse({ type: DebtResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateDebt(
    @Param("debtId") debtId: string,
    @Body() body: UpdateDebtDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.debtsService.updateDebt(debtId, body, user);
  }

  @Post("debts/:debtId/add")
  @HttpCode(200)
  @ApiOperation({ operationId: "addToDebt", summary: "Add to a debt" })
  @ApiParam({ name: "debtId", type: String })
  @ApiBody({ type: AddToDebtDto })
  @ApiOkResponse({ type: DebtResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async addToDebt(@Param("debtId") debtId: string, @Body() body: AddToDebtDto, @CurrentUser() user: AuthenticatedUser) {
    return this.debtsService.addToDebt(debtId, body, user);
  }

  @Post("debts/:debtId/close")
  @HttpCode(200)
  @ApiOperation({ operationId: "closeDebt", summary: "Close or pay down a debt" })
  @ApiParam({ name: "debtId", type: String })
  @ApiBody({ type: CloseDebtDto })
  @ApiOkResponse({ type: DebtResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async closeDebt(@Param("debtId") debtId: string, @Body() body: CloseDebtDto, @CurrentUser() user: AuthenticatedUser) {
    return this.debtsService.closeDebt(debtId, body, user);
  }

  @Delete("debts/:debtId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteDebt", summary: "Delete a debt" })
  @ApiParam({ name: "debtId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteDebt(@Param("debtId") debtId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.debtsService.deleteDebt(debtId, user);
  }

  @Patch("debt-transactions/:debtTransactionId")
  @ApiOperation({ operationId: "updateDebtTransaction", summary: "Update a debt transaction" })
  @ApiParam({ name: "debtTransactionId", type: String })
  @ApiBody({ type: UpdateDebtEntryTransactionDto })
  @ApiOkResponse({ type: DebtTransactionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateDebtTransaction(
    @Param("debtTransactionId") debtTransactionId: string,
    @Body() body: UpdateDebtEntryTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.debtsService.updateDebtTransaction(debtTransactionId, body, user);
  }

  @Delete("debt-transactions/:debtTransactionId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteDebtTransaction", summary: "Delete a debt transaction" })
  @ApiParam({ name: "debtTransactionId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteDebtTransaction(
    @Param("debtTransactionId") debtTransactionId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.debtsService.deleteDebtTransaction(debtTransactionId, user);
  }
}
