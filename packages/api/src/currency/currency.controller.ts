import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiExtraModels,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { ApiErrorDto } from "@/common/api-error.dto";

import {
  ExchangeRateQueryDto,
  ExchangeRateResponseDto,
  ExchangeRatesResponseDto,
  UpdateExchangeRatesResponseDto,
} from "./currency.dto";
import { ExchangeRateService } from "./exchange-rate.service";

@Controller("exchange-rates")
@ApiTags("Currency")
@ApiExtraModels(ExchangeRateQueryDto)
export class CurrencyController {
  constructor(@Inject(ExchangeRateService) private readonly exchangeRateService: ExchangeRateService) {}

  @Get()
  @ApiOperation({ operationId: "getLatestExchangeRates", summary: "Get latest exchange rates" })
  @ApiOkResponse({ type: ExchangeRatesResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getLatestExchangeRates() {
    const result = await this.exchangeRateService.getNBRBExchangeRates();

    if ("error" in result) {
      throw new ServiceUnavailableException(result.error);
    }

    return { data: result.data };
  }

  @Get("rate")
  @ApiOperation({ operationId: "getExchangeRate", summary: "Get one exchange rate for a date" })
  @ApiQuery({ name: "date", required: true, type: String })
  @ApiQuery({ name: "fromCurrency", enum: ["USD", "EUR", "RUB", "BYN"], required: true, type: String })
  @ApiQuery({ name: "toCurrency", enum: ["USD", "EUR", "RUB", "BYN"], required: true, type: String })
  @ApiOkResponse({ type: ExchangeRateResponseDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getExchangeRate(@Query() query: ExchangeRateQueryDto) {
    try {
      return {
        data: await this.exchangeRateService.getExchangeRate(query.date, query.fromCurrency, query.toCurrency),
      };
    } catch (error: unknown) {
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "Не удалось получить курс");
    }
  }

  @Get("today")
  @ApiOperation({ operationId: "getTodayExchangeRates", summary: "Get today's exchange rates" })
  @ApiOkResponse({ type: ExchangeRatesResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getTodayExchangeRates() {
    try {
      return { data: await this.exchangeRateService.getTodayExchangeRates() };
    } catch (error: unknown) {
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "Не удалось получить курсы валют");
    }
  }

  @Get("yesterday")
  @ApiOperation({ operationId: "getYesterdayExchangeRates", summary: "Get yesterday's exchange rates" })
  @ApiOkResponse({ type: ExchangeRatesResponseDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async getYesterdayExchangeRates() {
    try {
      return { data: await this.exchangeRateService.getYesterdayExchangeRates() };
    } catch (error: unknown) {
      throw new ServiceUnavailableException(
        error instanceof Error ? error.message : "Не удалось получить вчерашние курсы валют"
      );
    }
  }
}

@Controller("cron")
@ApiTags("Cron")
export class CurrencyCronController {
  constructor(@Inject(ExchangeRateService) private readonly exchangeRateService: ExchangeRateService) {}

  @Get("update-exchange-rates")
  @ApiOperation({ operationId: "updateExchangeRatesCron", summary: "Persist daily exchange rates" })
  @ApiHeader({ description: "Bearer CRON_SECRET", name: "authorization", required: true })
  @ApiOkResponse({ type: UpdateExchangeRatesResponseDto })
  @ApiUnauthorizedResponse({ type: ApiErrorDto })
  @ApiServiceUnavailableResponse({ type: ApiErrorDto })
  async updateExchangeRates(@Headers("authorization") authorization?: string) {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
      throw new UnauthorizedException("Unauthorized");
    }

    try {
      const rates = await this.exchangeRateService.saveDailyExchangeRates();
      return {
        success: true,
        saved: rates.filter(Boolean).length,
        rates,
      };
    } catch (error: unknown) {
      throw new ServiceUnavailableException(error instanceof Error ? error.message : "Failed to update exchange rates");
    }
  }
}
