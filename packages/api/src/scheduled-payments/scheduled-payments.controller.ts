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
import { WorkspaceAccessGuard } from "@/workspace/workspace-access.guard";

import {
  CreateScheduledPaymentDto,
  MarkScheduledPaymentPaidDto,
  MarkScheduledPaymentPaidResponseDto,
  ScheduledPaymentRecordsResponseDto,
  ScheduledPaymentSingleResponseDto,
  ScheduledPaymentsQueryDto,
  ScheduledPaymentsResponseDto,
  SkipScheduledPaymentDto,
  SnoozeScheduledPaymentDto,
  UpdateScheduledPaymentDto,
} from "./scheduled-payments.dto";
import { ScheduledPaymentsService } from "./scheduled-payments.service";

@Controller("workspaces/:workspaceId/scheduled-payments")
@ApiTags("Scheduled payments")
@UseGuards(AuthGuard, EmailVerifiedGuard, WorkspaceAccessGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
@ApiExtraModels(ScheduledPaymentsQueryDto)
export class ScheduledPaymentsController {
  constructor(@Inject(ScheduledPaymentsService) private readonly scheduledPaymentsService: ScheduledPaymentsService) {}

  @Get()
  @ApiOperation({ operationId: "listScheduledPayments", summary: "List scheduled payments" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ name: "displayStatus", required: false, type: String })
  @ApiQuery({ name: "assignedUserIds", required: false, type: [String] })
  @ApiQuery({ name: "accountIds", required: false, type: [String] })
  @ApiQuery({ name: "categoryIds", required: false, type: [String] })
  @ApiQuery({ name: "dueFrom", required: false, type: String })
  @ApiQuery({ name: "dueTo", required: false, type: String })
  @ApiQuery({ name: "skip", required: false, type: Number })
  @ApiQuery({ name: "take", required: false, type: Number })
  @ApiOkResponse({ type: ScheduledPaymentsResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async listScheduledPayments(
    @Param("workspaceId") workspaceId: string,
    @Query() query: ScheduledPaymentsQueryDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.listScheduledPayments(workspaceId, query, user);
  }

  @Post()
  @ApiOperation({ operationId: "createScheduledPayment", summary: "Create a scheduled payment" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiBody({ type: CreateScheduledPaymentDto })
  @ApiCreatedResponse({ type: ScheduledPaymentSingleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async createScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateScheduledPaymentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.createScheduledPayment(workspaceId, body, user);
  }

  @Get(":id")
  @ApiOperation({ operationId: "getScheduledPayment", summary: "Get a scheduled payment" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: ScheduledPaymentSingleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.getScheduledPayment(workspaceId, id, user);
  }

  @Patch(":id")
  @ApiOperation({ operationId: "updateScheduledPayment", summary: "Update a scheduled payment" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: UpdateScheduledPaymentDto })
  @ApiOkResponse({ type: ScheduledPaymentSingleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async updateScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() body: UpdateScheduledPaymentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.updateScheduledPayment(workspaceId, id, body, user);
  }

  @Post(":id/pay")
  @ApiOperation({ operationId: "markScheduledPaymentPaid", summary: "Mark a scheduled payment as paid" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: MarkScheduledPaymentPaidDto })
  @ApiOkResponse({ type: MarkScheduledPaymentPaidResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async markScheduledPaymentPaid(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() body: MarkScheduledPaymentPaidDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.markPaid(workspaceId, id, body, user);
  }

  @Post(":id/skip")
  @ApiOperation({ operationId: "skipScheduledPayment", summary: "Skip the current scheduled payment occurrence" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: SkipScheduledPaymentDto })
  @ApiOkResponse({ type: MarkScheduledPaymentPaidResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async skipScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() body: SkipScheduledPaymentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.skip(workspaceId, id, body, user);
  }

  @Post(":id/snooze")
  @ApiOperation({ operationId: "snoozeScheduledPayment", summary: "Snooze scheduled payment reminders" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiBody({ type: SnoozeScheduledPaymentDto })
  @ApiOkResponse({ type: ScheduledPaymentSingleResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async snoozeScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @Body() body: SnoozeScheduledPaymentDto,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.snooze(workspaceId, id, body, user);
  }

  @Get(":id/history")
  @ApiOperation({ operationId: "getScheduledPaymentHistory", summary: "Get scheduled payment history" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiOkResponse({ type: ScheduledPaymentRecordsResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async getScheduledPaymentHistory(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.scheduledPaymentsService.getHistory(workspaceId, id, user);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ operationId: "deleteScheduledPayment", summary: "Delete a scheduled payment" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiParam({ name: "id", type: String })
  @ApiNoContentResponse()
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async deleteScheduledPayment(
    @Param("workspaceId") workspaceId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    await this.scheduledPaymentsService.deleteScheduledPayment(workspaceId, id, user);
  }
}
