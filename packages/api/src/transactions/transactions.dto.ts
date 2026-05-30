import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const PAYMENT_TRANSACTION_TYPES = ["income", "expense"] as const;
const DASHBOARD_TRANSACTION_TYPES = ["income", "expense", "transfer", "debt"] as const;
const CATEGORY_TYPES = ["income", "expense"] as const;
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

function toOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

export class NewPaymentCategoryDto {
  @ApiProperty({ example: "Groceries", minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: CATEGORY_TYPES, example: "expense", type: String })
  @IsIn(CATEGORY_TYPES)
  type!: string;
}

export class CreatePaymentTransactionDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsString()
  @MinLength(1)
  accountId!: string;

  @ApiProperty({ example: "125.50", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiProperty({ enum: PAYMENT_TRANSACTION_TYPES, example: "expense", type: String })
  @IsIn(PAYMENT_TRANSACTION_TYPES)
  type!: string;

  @ApiPropertyOptional({ example: "Lunch", type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f2222", type: String })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ type: NewPaymentCategoryDto })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => NewPaymentCategoryDto)
  newCategory?: NewPaymentCategoryDto;
}

export class UpdatePaymentTransactionDto {
  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsOptional()
  @IsString()
  accountId?: string;

  @ApiPropertyOptional({ example: "125.50", type: String })
  @IsOptional()
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount?: string;

  @ApiPropertyOptional({ example: "Lunch", type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  date?: Date;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f2222", nullable: true, type: String })
  @IsOptional()
  @IsString()
  categoryId?: string | null;
}

export class CreateTransferTransactionDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  @IsString()
  @MinLength(1)
  fromAccountId!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  @IsString()
  @MinLength(1)
  toAccountId!: string;

  @ApiProperty({ example: "50", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  amount!: string;

  @ApiProperty({ example: "49.50", type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, { message: "Сумма должна быть больше 0" })
  toAmount!: string;

  @ApiPropertyOptional({ example: "Cash move", type: String })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;
}

export class UpdateTransferTransactionDto extends CreateTransferTransactionDto {}

export class CombinedTransactionsQueryDto {
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

  @ApiPropertyOptional({ enum: DASHBOARD_TRANSACTION_TYPES, isArray: true, type: String })
  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @IsIn(DASHBOARD_TRANSACTION_TYPES, { each: true })
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

  @ApiPropertyOptional({ example: true, type: Boolean })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  includeDebtTransactions?: boolean;
}

export class TransactionUserDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  name!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  image!: string | null;
}

export class TransactionAccountDto {
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

  @ApiPropertyOptional({ nullable: true, type: String })
  ownerId!: string | null;

  @ApiPropertyOptional({ nullable: true, type: TransactionUserDto })
  owner!: TransactionUserDto | null;
}

export class TransactionCategoryDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;
}

export class PaymentTransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  accountId!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiProperty({ enum: PAYMENT_TRANSACTION_TYPES, type: String })
  type!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  date!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  categoryId!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ type: TransactionAccountDto })
  account!: TransactionAccountDto;

  @ApiPropertyOptional({ nullable: true, type: TransactionCategoryDto })
  category!: TransactionCategoryDto | null;
}

export class TransferTransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  fromAccountId!: string;

  @ApiProperty({ type: String })
  toAccountId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  createdById!: string | null;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiProperty({ type: String })
  toAmount!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  date!: string;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;

  @ApiProperty({ type: TransactionAccountDto })
  fromAccount!: TransactionAccountDto;

  @ApiProperty({ type: TransactionAccountDto })
  toAccount!: TransactionAccountDto;

  @ApiPropertyOptional({ nullable: true, type: TransactionUserDto })
  createdBy!: TransactionUserDto | null;
}

export class DebtTransactionDebtDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
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

  @ApiProperty({ format: "date-time", type: String })
  date!: string;

  @ApiProperty({ type: String })
  status!: string;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ format: "date-time", type: String })
  updatedAt!: string;
}

export class DebtTransactionDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  workspaceId!: string;

  @ApiProperty({ type: String })
  debtId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  accountId!: string | null;

  @ApiProperty({ type: String })
  type!: string;

  @ApiProperty({ type: String })
  amount!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  toAmount!: string | null;

  @ApiProperty({ format: "date-time", type: String })
  date!: string;

  @ApiProperty({ format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ type: DebtTransactionDebtDto })
  debt!: DebtTransactionDebtDto;

  @ApiPropertyOptional({ nullable: true, type: TransactionAccountDto })
  account!: TransactionAccountDto | null;
}

export class PaymentCombinedTransactionDto {
  @ApiProperty({ enum: ["paymentTransaction"], type: String })
  kind!: "paymentTransaction";

  @ApiProperty({ type: PaymentTransactionDto })
  data!: PaymentTransactionDto;
}

export class TransferCombinedTransactionDto {
  @ApiProperty({ enum: ["transferTransaction"], type: String })
  kind!: "transferTransaction";

  @ApiProperty({ type: TransferTransactionDto })
  data!: TransferTransactionDto;
}

export class DebtCombinedTransactionDto {
  @ApiProperty({ enum: ["debtTransaction"], type: String })
  kind!: "debtTransaction";

  @ApiProperty({ type: DebtTransactionDto })
  data!: DebtTransactionDto;
}

@ApiExtraModels(PaymentCombinedTransactionDto, TransferCombinedTransactionDto, DebtCombinedTransactionDto)
export class CombinedTransactionsResponseDto {
  @ApiProperty({
    items: {
      oneOf: [
        { $ref: getSchemaPath(PaymentCombinedTransactionDto) },
        { $ref: getSchemaPath(TransferCombinedTransactionDto) },
        { $ref: getSchemaPath(DebtCombinedTransactionDto) },
      ],
    },
    type: "array",
  })
  data!: Array<PaymentCombinedTransactionDto | TransferCombinedTransactionDto | DebtCombinedTransactionDto>;

  @ApiProperty({ example: 42, type: Number })
  total!: number;
}

export class PaymentTransactionResponseDto {
  @ApiProperty({ type: PaymentTransactionDto })
  transaction!: PaymentTransactionDto;
}

export class TransferTransactionResponseDto {
  @ApiProperty({ type: TransferTransactionDto })
  transfer!: TransferTransactionDto;
}
