import { revalidatePath } from "next/cache";

export function revalidateAccountingRoutes() {
  revalidatePath("/dashboard");
}

export function revalidateDebtRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/debts");
}

export function revalidateWorkspaceRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/debts");
}
