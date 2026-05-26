import { ApiProperty } from "@nestjs/swagger";
import { Currency } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDate, IsIn } from "class-validator";

const CURRENCIES = [Currency.USD, Currency.EUR, Currency.BYN] as const;

export class ExchangeRateQueryDto {
  @ApiProperty({ example: "2026-05-25T12:00:00.000Z", format: "date-time", type: String })
  @Type(() => Date)
  @IsDate()
  date!: Date;

  @ApiProperty({ enum: CURRENCIES, example: Currency.USD, type: String })
  @IsIn(CURRENCIES)
  fromCurrency!: Currency;

  @ApiProperty({ enum: CURRENCIES, example: Currency.BYN, type: String })
  @IsIn(CURRENCIES)
  toCurrency!: Currency;
}

export class ExchangeRateResponseDto {
  @ApiProperty({ example: 3.2721, type: Number })
  data!: number;
}

export class ExchangeRatesResponseDto {
  @ApiProperty({
    additionalProperties: { type: "number" },
    example: { BYN: 1, EUR: 3.6124, USD: 3.2721 },
    type: "object",
  })
  data!: Record<string, number>;
}

export class SavedExchangeRateDto {
  @ApiProperty({ example: "665f5d865ef5a20c0d2f1111", type: String })
  id!: string;

  @ApiProperty({ example: "2026-05-25T00:00:00.000Z", format: "date-time", type: String })
  date!: string;

  @ApiProperty({ enum: CURRENCIES, example: Currency.USD, type: String })
  fromCurrency!: Currency;

  @ApiProperty({ enum: CURRENCIES, example: Currency.BYN, type: String })
  toCurrency!: Currency;

  @ApiProperty({ example: 3.2721, type: Number })
  rate!: number;
}

export class UpdateExchangeRatesResponseDto {
  @ApiProperty({ example: true, type: Boolean })
  success!: boolean;

  @ApiProperty({ example: 2, type: Number })
  saved!: number;

  @ApiProperty({ type: [SavedExchangeRateDto] })
  rates!: SavedExchangeRateDto[];
}
