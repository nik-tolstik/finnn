import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsArray, IsIn, IsOptional, IsString } from "class-validator";

const ANALYTICS_TRANSACTION_TYPES = ["income", "expense", "transfer", "debt"] as const;
const ANALYTICS_MOVEMENT_KINDS = ["paymentTransaction", "transferTransaction", "debtTransaction"] as const;

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.flatMap((item) => toStringArray(item) ?? []);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [String(value)];
}

export class AnalyticsOverviewQueryDto {
  @ApiPropertyOptional({ example: "10", type: String })
  @IsOptional()
  @IsString()
  amountFrom?: string;

  @ApiPropertyOptional({ example: "500", type: String })
  @IsOptional()
  @IsString()
  amountTo?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ enum: ANALYTICS_TRANSACTION_TYPES, isArray: true, type: String })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(ANALYTICS_TRANSACTION_TYPES, { each: true })
  transactionTypes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  accountIds?: string[];

  @ApiPropertyOptional({ example: "lunch", type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "2026-05-01", type: String })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ example: "2026-05-31", type: String })
  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class AnalyticsEffectiveRangeDto {
  @ApiProperty({ example: "2026-05-01", type: String })
  startDate!: string;

  @ApiProperty({ example: "2026-05-31", type: String })
  endDate!: string;

  @ApiProperty({ example: "2026-04-01", type: String })
  previousStartDate!: string;

  @ApiProperty({ example: "2026-04-30", type: String })
  previousEndDate!: string;

  @ApiProperty({ example: 31, type: Number })
  dayCount!: number;

  @ApiProperty({ example: false, type: Boolean })
  isImplicit!: boolean;
}

export class AnalyticsSummaryMetricDto {
  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  previousTotalInBaseCurrency!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  percentageChange!: number | null;

  @ApiProperty({ type: Number })
  transactionCount!: number;
}

export class AnalyticsNetFlowMetricDto {
  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  previousTotalInBaseCurrency!: string;

  @ApiPropertyOptional({ nullable: true, type: Number })
  percentageChange!: number | null;
}

export class AnalyticsTransferVolumeMetricDto {
  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;

  @ApiProperty({ type: Number })
  transactionCount!: number;
}

export class AnalyticsOpenDebtsMetricDto {
  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;

  @ApiProperty({ type: Number })
  debtCount!: number;
}

export class AnalyticsSummaryDto {
  @ApiProperty({ type: AnalyticsSummaryMetricDto })
  income!: AnalyticsSummaryMetricDto;

  @ApiProperty({ type: AnalyticsSummaryMetricDto })
  expense!: AnalyticsSummaryMetricDto;

  @ApiProperty({ type: AnalyticsNetFlowMetricDto })
  netFlow!: AnalyticsNetFlowMetricDto;

  @ApiProperty({ type: AnalyticsTransferVolumeMetricDto })
  transferVolume!: AnalyticsTransferVolumeMetricDto;

  @ApiProperty({ type: AnalyticsOpenDebtsMetricDto })
  openDebts!: AnalyticsOpenDebtsMetricDto;
}

export class AnalyticsComparisonDto {
  @ApiProperty({ type: String })
  incomePreviousTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  expensePreviousTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  netFlowPreviousTotalInBaseCurrency!: string;
}

export class AnalyticsTimeSeriesPointDto {
  @ApiProperty({ example: "2026-05-01", type: String })
  date!: string;

  @ApiProperty({ type: String })
  incomeTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  expenseTotalInBaseCurrency!: string;
}

export class AnalyticsCalendarDayDto {
  @ApiProperty({ example: "2026-05-01", type: String })
  date!: string;

  @ApiProperty({ type: String })
  incomeTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  expenseTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  netTotalInBaseCurrency!: string;

  @ApiProperty({ type: Number })
  transactionCount!: number;
}

export class AnalyticsCapitalTimeSeriesPointDto {
  @ApiProperty({ example: "2026-05-01", type: String })
  date!: string;

  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;
}

export class AnalyticsExpenseCategoryDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  totalInBaseCurrency!: string;

  @ApiProperty({ type: Number })
  transactionCount!: number;

  @ApiProperty({ type: Number })
  sharePercent!: number;
}

export class AnalyticsDebtByPersonDto {
  @ApiProperty({ type: String })
  personName!: string;

  @ApiProperty({ type: String })
  lentTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  borrowedTotalInBaseCurrency!: string;

  @ApiProperty({ type: String })
  netExposureInBaseCurrency!: string;

  @ApiProperty({ type: Number })
  debtCount!: number;
}

export class AnalyticsLargestMovementDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ enum: ANALYTICS_MOVEMENT_KINDS, type: String })
  kind!: string;

  @ApiProperty({ type: String })
  kindLabel!: string;

  @ApiProperty({ example: "2026-05-01", type: String })
  date!: string;

  @ApiProperty({ type: String })
  primaryLabel!: string;

  @ApiProperty({ type: String })
  secondaryLabel!: string;

  @ApiProperty({ type: String })
  originalAmount!: string;

  @ApiProperty({ type: String })
  amountInBaseCurrency!: string;
}

export class AnalyticsOverviewResponseDto {
  @ApiProperty({ example: "BYN", type: String })
  baseCurrency!: string;

  @ApiProperty({ type: AnalyticsEffectiveRangeDto })
  effectiveRange!: AnalyticsEffectiveRangeDto;

  @ApiProperty({ type: AnalyticsSummaryDto })
  summary!: AnalyticsSummaryDto;

  @ApiProperty({ type: AnalyticsComparisonDto })
  comparison!: AnalyticsComparisonDto;

  @ApiProperty({ type: [AnalyticsTimeSeriesPointDto] })
  timeSeries!: AnalyticsTimeSeriesPointDto[];

  @ApiProperty({ type: [AnalyticsCapitalTimeSeriesPointDto] })
  capitalTimeSeries!: AnalyticsCapitalTimeSeriesPointDto[];

  @ApiProperty({ type: [AnalyticsExpenseCategoryDto] })
  incomeCategories!: AnalyticsExpenseCategoryDto[];

  @ApiProperty({ type: [AnalyticsExpenseCategoryDto] })
  expenseCategories!: AnalyticsExpenseCategoryDto[];

  @ApiProperty({ type: [AnalyticsDebtByPersonDto] })
  debtsByPerson!: AnalyticsDebtByPersonDto[];

  @ApiProperty({ type: [AnalyticsLargestMovementDto] })
  largestMovements!: AnalyticsLargestMovementDto[];
}

export class AnalyticsCalendarResponseDto {
  @ApiProperty({ example: "BYN", type: String })
  baseCurrency!: string;

  @ApiProperty({ type: AnalyticsEffectiveRangeDto })
  effectiveRange!: AnalyticsEffectiveRangeDto;

  @ApiProperty({ type: [AnalyticsCalendarDayDto] })
  calendarDays!: AnalyticsCalendarDayDto[];
}
