import { revalidatePath } from "next/cache";

export function revalidateAccountingRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

export function revalidateDebtRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/debts");
  revalidatePath("/analytics");
}

export function revalidateWorkspaceRoutes() {
  revalidatePath("/dashboard");
  revalidatePath("/debts");
  revalidatePath("/analytics");
}
