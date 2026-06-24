import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
} from "class-validator";

import {
  DEFAULT_SCHEDULED_PAYMENT_TIMEZONE,
  SCHEDULED_PAYMENT_AMOUNT_MODES,
  SCHEDULED_PAYMENT_DISPLAY_STATUSES,
  SCHEDULED_PAYMENT_RECORD_STATUSES,
  SCHEDULED_PAYMENT_REMINDER_CHANNELS,
  SCHEDULED_PAYMENT_REMINDER_STATUSES,
  SCHEDULED_PAYMENT_SCHEDULE_KINDS,
  SCHEDULED_PAYMENT_SCHEDULE_UNITS,
} from "./scheduled-payments.types";

const POSITIVE_MONEY_PATTERN = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

function toStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (Array.isArray(value)) return value.flatMap((item) => toStringArray(item) ?? []);
  if (typeof value === "string")
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  return [String(value)];
}

function toNumberArray(value: unknown): number[] | undefined {
  const values = toStringArray(value);
  if (!values) return undefined;
  return values.map((item) => Number(item));
}

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

export class ScheduledPaymentsQueryDto {
  @ApiPropertyOptional({ enum: SCHEDULED_PAYMENT_DISPLAY_STATUSES, type: String })
  @IsOptional()
  @IsIn(SCHEDULED_PAYMENT_DISPLAY_STATUSES)
  displayStatus?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  assignedUserIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  accountIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsString({ each: true })
  categoryIds?: string[];

  @ApiPropertyOptional({ example: "2026-06-01T00:00:00.000Z", type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueFrom?: Date;

  @ApiPropertyOptional({ example: "2026-06-30T23:59:59.999Z", type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueTo?: Date;

  @ApiPropertyOptional({ example: 0, minimum: 0, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({ example: 50, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

export class CreateScheduledPaymentDto {
  @ApiProperty({ example: "A1 mobile", minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_AMOUNT_MODES, example: "fixed", type: String })
  @IsIn(SCHEDULED_PAYMENT_AMOUNT_MODES)
  amountMode!: string;

  @ApiPropertyOptional({ example: "35.50", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount?: string;

  @ApiPropertyOptional({ example: "20", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Минимальная сумма должна быть больше 0" })
  amountMin?: string;

  @ApiPropertyOptional({ example: "60", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Максимальная сумма должна быть больше 0" })
  amountMax?: string;

  @ApiPropertyOptional({ example: "BYN", type: String })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f2222", type: String })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsOptional()
  @IsString()
  accountId?: string | null;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f3333", type: String })
  @IsOptional()
  @IsString()
  assignedUserId?: string | null;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_SCHEDULE_KINDS, example: "monthly", type: String })
  @IsIn(SCHEDULED_PAYMENT_SCHEDULE_KINDS)
  scheduleKind!: string;

  @ApiPropertyOptional({ example: 1, minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scheduleInterval?: number;

  @ApiPropertyOptional({ enum: SCHEDULED_PAYMENT_SCHEDULE_UNITS, type: String })
  @IsOptional()
  @IsIn(SCHEDULED_PAYMENT_SCHEDULE_UNITS)
  scheduleUnit?: string | null;

  @ApiPropertyOptional({ example: 31, minimum: 1, maximum: 31, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number | null;

  @ApiPropertyOptional({ example: 12, minimum: 1, maximum: 12, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  dueMonth?: number | null;

  @ApiProperty({ example: "2026-06-25T09:00:00.000Z", type: String })
  @Type(() => Date)
  @IsDate()
  nextDueAt!: Date;

  @ApiPropertyOptional({ example: DEFAULT_SCHEDULED_PAYMENT_TIMEZONE, type: String })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ example: [7, 3, 1, 0], type: [Number] })
  @IsOptional()
  @Transform(({ value }) => toNumberArray(value) ?? [])
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  reminderDaysBefore?: number[];

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  notifyTelegram?: boolean;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional({ example: "Contract #42", type: String })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateScheduledPaymentDto {
  @ApiPropertyOptional({ example: "A1 mobile", minLength: 1, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: SCHEDULED_PAYMENT_AMOUNT_MODES, type: String })
  @IsOptional()
  @IsIn(SCHEDULED_PAYMENT_AMOUNT_MODES)
  amountMode?: string;

  @ApiPropertyOptional({ example: "35.50", nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount?: string | null;

  @ApiPropertyOptional({ example: "20", nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Минимальная сумма должна быть больше 0" })
  amountMin?: string | null;

  @ApiPropertyOptional({ example: "60", nullable: true, type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Максимальная сумма должна быть больше 0" })
  amountMax?: string | null;

  @ApiPropertyOptional({ example: "BYN", nullable: true, type: String })
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  categoryId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  accountId?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  assignedUserId?: string | null;

  @ApiPropertyOptional({ enum: SCHEDULED_PAYMENT_SCHEDULE_KINDS, type: String })
  @IsOptional()
  @IsIn(SCHEDULED_PAYMENT_SCHEDULE_KINDS)
  scheduleKind?: string;

  @ApiPropertyOptional({ minimum: 1, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  scheduleInterval?: number;

  @ApiPropertyOptional({ enum: SCHEDULED_PAYMENT_SCHEDULE_UNITS, nullable: true, type: String })
  @IsOptional()
  @IsIn(SCHEDULED_PAYMENT_SCHEDULE_UNITS)
  scheduleUnit?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 31, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number | null;

  @ApiPropertyOptional({ minimum: 1, maximum: 12, nullable: true, type: Number })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  dueMonth?: number | null;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextDueAt?: Date;

  @ApiPropertyOptional({ example: DEFAULT_SCHEDULED_PAYMENT_TIMEZONE, type: String })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @Transform(({ value }) => toNumberArray(value) ?? [])
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  reminderDaysBefore?: number[];

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  notifyTelegram?: boolean;

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  notifyEmail?: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class MarkScheduledPaymentPaidDto {
  @ApiProperty({ example: "35.50", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiPropertyOptional({ example: "BYN", type: String })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiProperty({ example: "2026-06-25T10:00:00.000Z", type: String })
  @Type(() => Date)
  @IsDate()
  paidAt!: Date;

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  createTransaction?: boolean;

  @ApiPropertyOptional({ type: String })
  @IsOptional()
  @IsString()
  transactionId?: string;

  @ApiPropertyOptional({ example: "Paid from mobile app", type: String })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SkipScheduledPaymentDto {
  @ApiPropertyOptional({ example: "Not needed this month", type: String })
  @IsOptional()
  @IsString()
  note?: string;
}

export class SnoozeScheduledPaymentDto {
  @ApiProperty({ example: 2, minimum: 1, type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  days!: number;
}

export class ScheduledPaymentResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_AMOUNT_MODES, type: String })
  amountMode!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  amount!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  amountMin!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  amountMax!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  categoryId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  assignedUserId!: string | null;

  @ApiProperty({ type: String })
  createdById!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_DISPLAY_STATUSES, type: String })
  displayStatus!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_SCHEDULE_KINDS, type: String })
  scheduleKind!: string;

  @ApiProperty({ type: Number })
  scheduleInterval!: number;

  @ApiPropertyOptional({ nullable: true, type: String })
  scheduleUnit!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  dueDay!: number | null;

  @ApiPropertyOptional({ nullable: true, type: Number })
  dueMonth!: number | null;

  @ApiProperty({ type: String })
  nextDueAt!: string;

  @ApiProperty({ type: String })
  timezone!: string;

  @ApiProperty({ type: [Number] })
  reminderDaysBefore!: number[];

  @ApiProperty({ type: Boolean })
  notifyTelegram!: boolean;

  @ApiProperty({ type: Boolean })
  notifyEmail!: boolean;

  @ApiPropertyOptional({ nullable: true, type: String })
  notes!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastPaidAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  snoozedUntil!: string | null;

  @ApiProperty({ type: String })
  createdAt!: string;

  @ApiProperty({ type: String })
  updatedAt!: string;
}

export class ScheduledPaymentsResponseDto {
  @ApiProperty({ type: [ScheduledPaymentResponseDto] })
  scheduledPayments!: ScheduledPaymentResponseDto[];

  @ApiProperty({ type: Number })
  total!: number;
}

export class ScheduledPaymentSingleResponseDto {
  @ApiProperty({ type: ScheduledPaymentResponseDto })
  scheduledPayment!: ScheduledPaymentResponseDto;
}

export class ScheduledPaymentRecordResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  scheduledPaymentId!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  transactionId!: string | null;

  @ApiProperty({ type: String })
  dueAt!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  paidAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  skippedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  amount!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  currency!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  categoryId!: string | null;

  @ApiProperty({ type: String })
  actionById!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_RECORD_STATUSES, type: String })
  status!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  note!: string | null;

  @ApiProperty({ type: String })
  createdAt!: string;
}

export class ScheduledPaymentRecordsResponseDto {
  @ApiProperty({ type: [ScheduledPaymentRecordResponseDto] })
  records!: ScheduledPaymentRecordResponseDto[];
}

export class MarkScheduledPaymentPaidResponseDto {
  @ApiProperty({ type: ScheduledPaymentResponseDto })
  scheduledPayment!: ScheduledPaymentResponseDto;

  @ApiProperty({ type: ScheduledPaymentRecordResponseDto })
  record!: ScheduledPaymentRecordResponseDto;

  @ApiPropertyOptional({ nullable: true, type: String })
  transactionId!: string | null;
}

export class ScheduledPaymentReminderDeliveryResponseDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  scheduledPaymentId!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  userId!: string;

  @ApiProperty({ type: String })
  dueAt!: string;

  @ApiProperty({ type: String })
  reminderDate!: string;

  @ApiProperty({ type: Number })
  daysBefore!: number;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_REMINDER_CHANNELS, type: String })
  channel!: string;

  @ApiProperty({ enum: SCHEDULED_PAYMENT_REMINDER_STATUSES, type: String })
  status!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  sentAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  error!: string | null;

  @ApiProperty({ type: String })
  createdAt!: string;
}

export class RunScheduledPaymentRemindersResponseDto {
  @ApiProperty({ type: Boolean })
  success!: boolean;

  @ApiProperty({ type: Number })
  processed!: number;

  @ApiProperty({ type: Number })
  sent!: number;

  @ApiProperty({ type: Number })
  failed!: number;

  @ApiProperty({ type: [ScheduledPaymentReminderDeliveryResponseDto] })
  deliveries!: ScheduledPaymentReminderDeliveryResponseDto[];
}
