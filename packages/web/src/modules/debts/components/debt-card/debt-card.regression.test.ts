import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("debt card presentation", () => {
  it("keeps the closed debt data visible without redundant state decoration", () => {
    const source = readSource("src/modules/debts/components/debt-card/DebtCard.tsx");

    expect(source).toContain("isClosed ? (");
    expect(source).toContain('className="grid min-w-0 grid-cols-2 items-start gap-x-3 gap-y-2 text-sm"');
    expect(source).not.toContain(">Сумма</div>");
    expect(source).not.toContain(">Остаток</div>");
    expect(source).toContain("formatMoney(debt.amount, debt.currency)");
    expect(source).toContain("formatMoney(debt.remainingAmount, debt.currency)");
    expect(source).not.toContain('isClosed && "opacity-60"');
    expect(source).not.toContain("CheckCircle2");
    expect(source).not.toContain('from "@/shared/ui/badge"');
    expect(source).toContain("shadow-inner");
    expect(source).toContain('isClosed ? "shadow-inner hover:bg-surface-hover" : "hover:shadow-md transition-shadow"');
    expect(source).toContain('aria-haspopup={onClick ? "dialog" : undefined}');
  });

  it("keeps the debt card keyboard accessible without changing its click contract", () => {
    const source = readSource("src/modules/debts/components/debt-card/DebtCard.tsx");

    expect(source).toContain('role={onClick ? "button" : undefined}');
    expect(source).toContain("tabIndex={onClick ? 0 : undefined}");
    expect(source).toContain('aria-haspopup={onClick ? "dialog" : undefined}');
    expect(source).toContain('event.key !== "Enter"');
    expect(source).toContain('event.key !== " "');
    expect(source).toContain("onClick(event.currentTarget);");
    expect(source).toContain("onClick(event.currentTarget) : undefined");
  });
});
