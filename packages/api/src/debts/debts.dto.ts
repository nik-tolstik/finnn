import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsDate, IsIn, IsOptional, IsString, Matches, MinLength } from "class-validator";

const DEBT_TYPES = ["lent", "borrowed"] as const;
const DEBT_STATUSES = ["open", "closed"] as const;
const DEBT_TRANSACTION_TYPES = ["created", "closed", "added"] as const;
const POSITIVE_MONEY_PATTERN = /^(?=.*[1-9])\d+(?:\.\d+)?$/;

export class CreateDebtDto {
  @ApiProperty({ enum: DEBT_TYPES, example: "lent", type: String })
  @IsIn(DEBT_TYPES)
  type!: string;

  @ApiProperty({ example: "Grace", minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  personName!: string;

  @ApiProperty({ example: "100", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ example: true, type: Boolean })
  @IsBoolean()
  useAccount!: boolean;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ example: "BYN", type: String })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class CloseDebtDto {
  @ApiProperty({ example: "80", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiPropertyOptional({ example: "81.50", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  toAmount?: string;

  @ApiPropertyOptional({ example: "95", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  paymentAmount?: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f2222", type: String })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: false, type: Boolean })
  @IsOptional()
  @IsBoolean()
  closeEarly?: boolean;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ example: true, type: Boolean })
  @IsBoolean()
  useAccount!: boolean;
}

export class AddToDebtDto {
  @ApiProperty({ example: "20", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiProperty({ example: true, type: Boolean })
  @IsBoolean()
  useAccount!: boolean;
}

export class UpdateDebtDto {
  @ApiProperty({ example: "Grace", minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  personName!: string;

  @ApiProperty({ example: "120", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;
}

export class UpdateDebtEntryTransactionDto {
  @ApiProperty({ example: "30", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiPropertyOptional({ example: "31.50", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  toAmount?: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;
}

export class DebtListQueryDto {
  @ApiPropertyOptional({ enum: DEBT_STATUSES, example: "open", type: String })
  @IsOptional()
  @IsIn(DEBT_STATUSES)
  status?: string;

  @ApiPropertyOptional({ enum: DEBT_TYPES, example: "lent", type: String })
  @IsOptional()
  @IsIn(DEBT_TYPES)
  type?: string;

  @ApiPropertyOptional({ example: "Grace", type: String })
  @IsOptional()
  @IsString()
  personName?: string;
}

export class DebtAccountDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  color!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  icon!: string | null;
}

export class DebtAccountWithOwnerDto extends DebtAccountDto {
  @ApiPropertyOptional({ nullable: true, type: String })
  ownerId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: Object })
  owner!: {
    id: string;
    name: string | null;
    email: string;
    image: string | null;
  } | null;
}

export class DebtDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ enum: DEBT_TYPES, type: String })
  type!: string;

  @ApiProperty({ type: String })
  personName!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiProperty({ type: String })
  remainingAmount!: string;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  date!: string;

  @ApiProperty({ enum: DEBT_STATUSES, type: String })
  status!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  updatedAt!: string;

  @ApiPropertyOptional({ nullable: true, type: DebtAccountDto })
  account!: DebtAccountDto | null;
}

export class DebtEditDataDto {
  @ApiProperty({ type: String })
  personName!: string;

  @ApiProperty({ type: String })
  initialAmount!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  initialDate!: string;

  @ApiProperty({ type: String })
  currency!: string;
}

export class DebtEntryTransactionDebtDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ enum: DEBT_TYPES, type: String })
  type!: string;

  @ApiProperty({ type: String })
  personName!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiProperty({ type: String })
  remainingAmount!: string;

  @ApiProperty({ type: String })
  currency!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  date!: string;

  @ApiProperty({ enum: DEBT_STATUSES, type: String })
  status!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  updatedAt!: string;
}

export class DebtEntryTransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  debtId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ enum: DEBT_TRANSACTION_TYPES, type: String })
  type!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  toAmount!: string | null;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  date!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ type: DebtEntryTransactionDebtDto })
  debt!: DebtEntryTransactionDebtDto;

  @ApiPropertyOptional({ nullable: true, type: DebtAccountWithOwnerDto })
  account!: DebtAccountWithOwnerDto | null;
}

export class DebtResponseDto {
  @ApiProperty({ type: DebtDto })
  debt!: DebtDto;
}

export class DebtListResponseDto {
  @ApiProperty({ type: [DebtDto] })
  data!: DebtDto[];

  @ApiProperty({ example: 1, type: Number })
  total!: number;
}

export class DebtEditDataResponseDto {
  @ApiProperty({ type: DebtEditDataDto })
  debt!: DebtEditDataDto;
}

export class DebtTransactionResponseDto {
  @ApiProperty({ type: DebtEntryTransactionDto })
  debtTransaction!: DebtEntryTransactionDto;
}
