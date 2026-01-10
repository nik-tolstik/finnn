import { prisma } from "../src/shared/lib/prisma";

async function clearExchangeRates() {
  try {
    const result = await prisma.exchangeRate.deleteMany({});
    console.log(`Удалено записей: ${result.count}`);
  } catch (error: any) {
    if (error.message?.includes("exchangeRate")) {
      console.log("Таблица exchange_rates не существует или пуста");
    } else {
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

clearExchangeRates();
