import { Module } from "@nestjs/common";

import { PrismaModule } from "@/prisma/prisma.module";

import { CurrencyController, CurrencyCronController } from "./currency.controller";
import { ExchangeRateService } from "./exchange-rate.service";

@Module({
  imports: [PrismaModule],
  controllers: [CurrencyController, CurrencyCronController],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class CurrencyModule {}
