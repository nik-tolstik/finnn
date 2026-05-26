import { Module } from "@nestjs/common";

import { PrismaModule } from "@/prisma/prisma.module";

import { ExchangeRateService } from "./exchange-rate.service";

@Module({
  imports: [PrismaModule],
  providers: [ExchangeRateService],
  exports: [ExchangeRateService],
})
export class CurrencyModule {}
