import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("debt card presentation", () => {
  it("keeps the closed debt data visible and removes the dimmed history state", () => {
    const source = readSource("src/modules/debts/components/debt-card/DebtCard.tsx");

    expect(source).toContain("isClosed ? (");
    expect(source).toContain("Закрыт");
    expect(source).toContain(">Сумма</div>");
    expect(source).toContain(">Остаток</div>");
    expect(source).toContain("formatMoney(debt.amount, debt.currency)");
    expect(source).toContain("formatMoney(debt.remainingAmount, debt.currency)");
    expect(source).not.toContain('isClosed && "opacity-60"');
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
