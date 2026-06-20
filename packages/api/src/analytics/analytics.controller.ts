import { Controller, Get, Inject, Param, Query, UseGuards } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { AuthGuard } from "@/auth/auth.guard";
import { EmailVerifiedGuard } from "@/auth/email-verified.guard";
import { AUTH_COOKIE_NAME } from "@/auth/session-cookie";
import { ApiErrorDto } from "@/common/api-error.dto";
import { WorkspaceAccessGuard } from "@/workspace/workspace-access.guard";

import { AnalyticsCalendarResponseDto, AnalyticsOverviewQueryDto, AnalyticsOverviewResponseDto } from "./analytics.dto";
import { AnalyticsService } from "./analytics.service";

@Controller("workspaces/:workspaceId/analytics")
@ApiTags("Analytics")
@UseGuards(AuthGuard, EmailVerifiedGuard, WorkspaceAccessGuard)
@ApiCookieAuth(AUTH_COOKIE_NAME)
@ApiExtraModels(AnalyticsOverviewQueryDto)
export class AnalyticsController {
  constructor(@Inject(AnalyticsService) private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  @ApiOperation({ operationId: "getAnalyticsOverview", summary: "Get workspace analytics overview" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ name: "amountFrom", required: false, type: String })
  @ApiQuery({ name: "amountTo", required: false, type: String })
  @ApiQuery({ name: "userIds", required: false, type: [String] })
  @ApiQuery({ name: "transactionTypes", required: false, type: [String] })
  @ApiQuery({ name: "categoryIds", required: false, type: [String] })
  @ApiQuery({ name: "accountIds", required: false, type: [String] })
  @ApiQuery({ name: "description", required: false, type: String })
  @ApiQuery({ name: "dateFrom", required: false, type: String })
  @ApiQuery({ name: "dateTo", required: false, type: String })
  @ApiOkResponse({ type: AnalyticsOverviewResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getAnalyticsOverview(@Param("workspaceId") workspaceId: string, @Query() query: AnalyticsOverviewQueryDto) {
    return this.analyticsService.getAnalyticsOverview(workspaceId, query);
  }

  @Get("calendar")
  @ApiOperation({ operationId: "getAnalyticsCalendar", summary: "Get workspace analytics calendar" })
  @ApiParam({ name: "workspaceId", type: String })
  @ApiQuery({ name: "amountFrom", required: false, type: String })
  @ApiQuery({ name: "amountTo", required: false, type: String })
  @ApiQuery({ name: "userIds", required: false, type: [String] })
  @ApiQuery({ name: "transactionTypes", required: false, type: [String] })
  @ApiQuery({ name: "categoryIds", required: false, type: [String] })
  @ApiQuery({ name: "accountIds", required: false, type: [String] })
  @ApiQuery({ name: "description", required: false, type: String })
  @ApiQuery({ name: "dateFrom", required: false, type: String })
  @ApiQuery({ name: "dateTo", required: false, type: String })
  @ApiOkResponse({ type: AnalyticsCalendarResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getAnalyticsCalendar(@Param("workspaceId") workspaceId: string, @Query() query: AnalyticsOverviewQueryDto) {
    return this.analyticsService.getAnalyticsCalendar(workspaceId, query);
  }
}
