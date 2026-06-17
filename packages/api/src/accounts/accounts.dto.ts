import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";

const ACCOUNT_CURRENCIES = ["USD", "EUR", "RUB", "BYN"] as const;

class AccountOwnerDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiProperty({ example: "Ada", nullable: true, type: String })
  name!: string | null;

  @ApiPropertyOptional({ example: "ada@example.com", nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ example: "avatar-01", nullable: true, type: String })
  image!: string | null;
}

export class CreateAccountDto {
  @ApiProperty({ example: "Main card", maxLength: 100, minLength: 1, type: String })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: "125.50", type: String })
  @IsString()
  @MinLength(1)
  balance!: string;

  @ApiProperty({ enum: ACCOUNT_CURRENCIES, example: "BYN", type: String })
  @IsIn(ACCOUNT_CURRENCIES)
  currency!: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", nullable: true, type: String })
  @IsOptional()
  @IsString()
  ownerId?: string | null;

  @ApiPropertyOptional({ example: "#0f766e", type: String })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: "wallet", type: String })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  createdAt!: Date;
}

export class UpdateAccountDto {
  @ApiPropertyOptional({ example: "Savings", maxLength: 100, minLength: 1, type: String })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: "200.00", type: String })
  @IsOptional()
  @IsString()
  balance?: string;

  @ApiPropertyOptional({ enum: ACCOUNT_CURRENCIES, example: "USD", type: String })
  @IsOptional()
  @IsIn(ACCOUNT_CURRENCIES)
  currency?: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", nullable: true, type: String })
  @IsOptional()
  @IsString()
  ownerId?: string | null;

  @ApiPropertyOptional({ example: "#2563eb", type: String })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ example: "landmark", type: String })
  @IsOptional()
  @IsString()
  icon?: string;

  @ApiPropertyOptional({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  createdAt?: Date;

  @ApiPropertyOptional({ example: 2, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class AccountOrderDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  @IsString()
  id!: string;

  @ApiProperty({ example: 0, type: Number })
  @IsInt()
  @Min(0)
  order!: number;
}

export class UpdateAccountsOrderDto {
  @ApiProperty({ type: [AccountOrderDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountOrderDto)
  accountOrders!: AccountOrderDto[];
}

export class AccountDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f2222", type: String })
  id!: string;

  @ApiProperty({ example: "665f5d865ef5a20c0d2f3333", type: String })
  workspaceId!: string;

  @ApiPropertyOptional({ example: "665f5d865ef5a20c0d2f1111", nullable: true, type: String })
  ownerId!: string | null;

  @ApiProperty({ example: "Main card", type: String })
  name!: string;

  @ApiProperty({ example: "125.50", type: String })
  balance!: string;

  @ApiProperty({ example: "BYN", type: String })
  currency!: string;

  @ApiPropertyOptional({ example: "Everyday spending", nullable: true, type: String })
  description!: string | null;

  @ApiPropertyOptional({ example: "#0f766e", nullable: true, type: String })
  color!: string | null;

  @ApiPropertyOptional({ example: "wallet", nullable: true, type: String })
  icon!: string | null;

  @ApiProperty({ example: false, type: Boolean })
  archived!: boolean;

  @ApiProperty({ example: 0, type: Number })
  order!: number;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  createdAt!: string;

  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  updatedAt!: string;

  @ApiPropertyOptional({ type: AccountOwnerDto, nullable: true })
  owner?: AccountOwnerDto | null;
}

export class AccountDependencyCountsDto {
  @ApiProperty({ example: 3, type: Number })
  transactions!: number;

  @ApiProperty({ example: 2, type: Number })
  debtTransactions!: number;
}

export class ArchivedAccountDto extends AccountDto {
  @ApiProperty({ type: AccountDependencyCountsDto })
  _count!: AccountDependencyCountsDto;
}

export class AccountResponseDto {
  @ApiProperty({ type: AccountDto })
  account!: AccountDto;
}

export class AccountListResponseDto {
  @ApiProperty({ type: [AccountDto] })
  accounts!: AccountDto[];
}

export class ArchivedAccountListResponseDto {
  @ApiProperty({ type: [ArchivedAccountDto] })
  accounts!: ArchivedAccountDto[];
}

export class AccountSuccessResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;
}
