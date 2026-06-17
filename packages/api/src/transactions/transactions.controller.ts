import { Body, Controller, Delete, Get, HttpCode, Inject, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiExtraModels,
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
import { EmailVerifiedGuard } from "@/auth/email-verified.guard";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";

import {
  CombinedTransactionsQueryDto,
  CombinedTransactionsResponseDto,
  CreatePaymentTransactionDto,
  CreateTransferTransactionDto,
  PaymentTransactionResponseDto,
  TransferTransactionResponseDto,
  UpdatePaymentTransactionDto,
  UpdateTransferTransactionDto,
} from "./transactions.dto";
import { TransactionsService } from "./transactions.service";

@Controller()
@ApiTags("Transactions")
@UseGuards(AuthGuard, EmailVerifiedGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
@ApiExtraModels(CombinedTransactionsQueryDto)
export class TransactionsController {
  constructor(@Inject(TransactionsService) private readonly transactionsService: TransactionsService) {}

  @Get("workspaces/:workspaceId/transactions")
  @ApiOperation({ operationId: "getCombinedTransactions", summary: "List combined transactions" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiQuery({ name: "amountFrom", required: false, type: String })
  @ApiQuery({ name: "amountTo", required: false, type: String })
  @ApiQuery({ name: "userIds", required: false, type: [String] })
  @ApiQuery({ name: "transactionTypes", required: false, type: [String] })
  @ApiQuery({ name: "categoryIds", required: false, type: [String] })
  @ApiQuery({ name: "accountIds", required: false, type: [String] })
  @ApiQuery({ name: "description", required: false, type: String })
  @ApiQuery({ name: "dateFrom", required: false, type: String })
  @ApiQuery({ name: "dateTo", required: false, type: String })
  @ApiQuery({ name: "includeDebtTransactions", required: false, type: Boolean })
  @ApiOkResponse({ type: CombinedTransactionsResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getCombinedTransactions(
    @Param("workspaceId") workspaceId: string,
    @Query() query: CombinedTransactionsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.transactionsService.getCombinedTransactions(workspaceId, query, user);
  }

  @Post("workspaces/:workspaceId/payment-transactions")
  @ApiOperation({ operationId: "createPaymentTransaction", summary: "Create a payment transaction" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreatePaymentTransactionDto })
  @ApiCreatedResponse({ type: PaymentTransactionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createPaymentTransaction(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreatePaymentTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.transactionsService.createPaymentTransaction(workspaceId, body, user);
  }

  @Patch("payment-transactions/:transactionId")
  @ApiOperation({ operationId: "updatePaymentTransaction", summary: "Update a payment transaction" })
  @ApiParam({ name: "transactionId", type: String })
  @ApiBody({ type: UpdatePaymentTransactionDto })
  @ApiOkResponse({ type: PaymentTransactionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updatePaymentTransaction(
    @Param("transactionId") transactionId: string,
    @Body() body: UpdatePaymentTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.transactionsService.updatePaymentTransaction(transactionId, body, user);
  }

  @Delete("payment-transactions/:transactionId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deletePaymentTransaction", summary: "Delete a payment transaction" })
  @ApiParam({ name: "transactionId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deletePaymentTransaction(
    @Param("transactionId") transactionId: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.transactionsService.deletePaymentTransaction(transactionId, user);
  }

  @Post("workspaces/:workspaceId/transfers")
  @ApiOperation({ operationId: "createTransferTransaction", summary: "Create a transfer transaction" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateTransferTransactionDto })
  @ApiCreatedResponse({ type: TransferTransactionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createTransferTransaction(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateTransferTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.transactionsService.createTransferTransaction(workspaceId, body, user);
  }

  @Patch("transfers/:transferId")
  @ApiOperation({ operationId: "updateTransferTransaction", summary: "Update a transfer transaction" })
  @ApiParam({ name: "transferId", type: String })
  @ApiBody({ type: UpdateTransferTransactionDto })
  @ApiOkResponse({ type: TransferTransactionResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateTransferTransaction(
    @Param("transferId") transferId: string,
    @Body() body: UpdateTransferTransactionDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.transactionsService.updateTransferTransaction(transferId, body, user);
  }

  @Delete("transfers/:transferId")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteTransferTransaction", summary: "Delete a transfer transaction" })
  @ApiParam({ name: "transferId", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteTransferTransaction(@Param("transferId") transferId: string, @CurrentUser() user: AuthenticatedUser) {
    await this.transactionsService.deleteTransferTransaction(transferId, user);
  }
}
