import { Controller, Get, Headers, Inject, UnauthorizedException } from "@nestjs/common";
import { ApiHeader, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from "@nestjs/swagger";

import { ApiErrorDto } from "@/common/api-error.dto";

import { RunScheduledPaymentRemindersResponseDto } from "./scheduled-payments.dto";
import { ScheduledPaymentsNotificationService } from "./scheduled-payments-notification.service";

@Controller("cron")
@ApiTags("Cron")
export class ScheduledPaymentsCronController {
  constructor(
    @Inject(ScheduledPaymentsNotificationService)
    private readonly scheduledPaymentsNotificationService: ScheduledPaymentsNotificationService
  ) {}

  @Get("scheduled-payment-reminders")
  @ApiOperation({ operationId: "runScheduledPaymentRemindersCron", summary: "Send scheduled payment reminders" })
  @ApiHeader({ description: "Bearer CRON_SECRET", name: "authorization", required: true })
  @ApiOkResponse({ type: RunScheduledPaymentRemindersResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  async runScheduledPaymentReminders(@Headers("authorization") authorization?: string) {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException("Unauthorized");
    }

    return this.scheduledPaymentsNotificationService.runReminderCron();
  }
}
