"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/shared/lib/auth";
import { prisma } from "@/shared/lib/prisma";
import { addMoney, subtractMoney } from "@/shared/utils/money";

export async function getAccountBalanceHistory(
  accountId: string,
  startDate?: Date,
  endDate?: Date
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return { error: "Unauthorized" };
    }

    const account = await prisma.account.findFirst({
      where: {
        id: accountId,
        workspace: {
          members: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    });

    if (!account) {
      return { error: "Account not found or access denied" };
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        accountId,
        date: {
          ...(startDate && { gte: startDate }),
          ...(endDate && { lte: endDate }),
        },
      },
      orderBy: { date: "asc" },
    });

    let runningBalance = account.balance;
    const balanceHistory = transactions
      .reverse()
      .map((transaction) => {
        if (transaction.type === "income") {
          runningBalance = subtractMoney(runningBalance, transaction.amount);
        } else if (transaction.type === "expense") {
          runningBalance = addMoney(runningBalance, transaction.amount);
        }

        return {
          date: transaction.date,
          balance: runningBalance,
        };
      })
      .reverse();

    return {
      data: balanceHistory,
    };
  } catch (error: any) {
    return { error: error.message || "Failed to fetch balance history" };
  }
}

