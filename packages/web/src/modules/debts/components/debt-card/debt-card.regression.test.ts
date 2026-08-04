import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("debt card presentation", () => {
  it("keeps the closed debt data visible without redundant state decoration", () => {
    const source = readSource("src/modules/debts/components/debt-card/DebtCard.tsx");

    expect(source).toContain("isClosed ? (");
    expect(source).toContain(">Сумма</div>");
    expect(source).toContain(">Остаток</div>");
    expect(source).toContain("formatMoney(debt.amount, debt.currency)");
    expect(source).toContain("formatMoney(debt.remainingAmount, debt.currency)");
    expect(source).not.toContain('isClosed && "opacity-60"');
    expect(source).not.toContain("CheckCircle2");
    expect(source).not.toContain('from "@/shared/ui/badge"');
  });

  it("keeps the debt card keyboard accessible without changing its click contract", () => {
    const source = readSource("src/modules/debts/components/debt-card/DebtCard.tsx");

    expect(source).toContain('role={onClick ? "button" : undefined}');
    expect(source).toContain("tabIndex={onClick ? 0 : undefined}");
    expect(source).toContain('event.key !== "Enter"');
    expect(source).toContain('event.key !== " "');
    expect(source).toContain("onClick();");
  });
});
