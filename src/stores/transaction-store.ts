import type { Transaction } from "@prisma/client";
import { create } from "zustand";

interface TransactionState {
  transactions: Transaction[];
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => void;
  removeTransaction: (id: string) => void;
}

export const useTransactionStore = create<TransactionState>((set) => ({
  transactions: [],
  setTransactions: (transactions) => set({ transactions }),
  addTransaction: (transaction) =>
    set((state) => ({
      transactions: [...state.transactions, transaction],
    })),
  updateTransaction: (id, updates) =>
    set((state) => ({
      transactions: state.transactions.map((t) =>
        t.id === id ? { ...t, ...updates } : t
      ),
    })),
  removeTransaction: (id) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== id),
    })),
}));

