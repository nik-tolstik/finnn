"use client";

import type { ReactNode } from "react";

import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";

import type { AccountSegmentType, DescriptionSegment } from "../utils/transactionDescription";

export type AccountChipData = { color: string | null; icon: ReactNode };

export type AccountChipsMap = Partial<Record<AccountSegmentType, AccountChipData>>;

interface TransactionDescriptionLineProps {
  segments: DescriptionSegment[];
  icon?: ReactNode;
  accountChips?: AccountChipsMap;
  categoryColor?: string | null;
  description?: string;
  onClick?: () => void;
  className?: string;
}

function hexToRgba(hex: string, alpha: number): string | undefined {
  const n = hex.replace(/^#/, "");
  if (n.length !== 6 || !/^[0-9a-fA-F]+$/.test(n)) return undefined;
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function TransactionDescriptionLine({
  segments,
  icon,
  accountChips,
  categoryColor,
  description,
  onClick,
  className,
}: TransactionDescriptionLineProps) {
  const [firstSegment, ...restSegments] = segments;
  const content = (
    <span className="text-sm leading-relaxed inline-flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <span className="inline-flex items-center gap-1">
        {icon ? <span className="text-muted-foreground [&>svg]:size-4">{icon}</span> : null}
        <span className={firstSegment?.highlight ? "font-semibold" : undefined}>{firstSegment?.text ?? ""}</span>
      </span>
      {restSegments.map((seg, i) => {
        const chip = seg.segmentType && seg.segmentType !== "category" && accountChips?.[seg.segmentType];
        if (seg.segmentType === "category") {
          const color = categoryColor ?? undefined;
          const bgColor = color ? hexToRgba(color, 0.1) : undefined;

          return (
            <span
              key={i}
              className={cn(
                "inline-flex rounded-md border px-1.5 py-0.5 text-xs font-medium",
                !color && "border-border bg-muted/50"
              )}
              style={
                color
                  ? {
                      borderColor: color ? hexToRgba(color, 0.5) : undefined,
                      ...(bgColor && { backgroundColor: bgColor }),
                    }
                  : undefined
              }
            >
              {seg.text}
            </span>
          );
        }
        if (chip) {
          return (
            <span
              key={i}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border border-border px-2 py-1 text-xs font-medium text-foreground",
                !chip.color && "bg-muted"
              )}
              style={{
                borderColor: chip.color ? hexToRgba(chip.color, 0.5) : undefined,
                backgroundColor: chip.color ? hexToRgba(chip.color, 0.08) : undefined,
              }}
            >
              <span style={{ color: chip.color ?? undefined }}>{chip.icon}</span>
              <span className="truncate">{seg.text}</span>
            </span>
          );
        }
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {seg.highlight ? <span className="font-semibold">{seg.text}</span> : <span>{seg.text}</span>}
          </span>
        );
      })}
    </span>
  );

  if (onClick) {
    return (
      <Card
        className={cn("cursor-pointer px-4 py-4 transition-colors hover:bg-accent/70", className)}
        onClick={onClick}
      >
        <div className="space-y-1.5">
          {content}
          {description ? (
            <p className="text-sm text-muted-foreground leading-snug wrap-break-word">{description}</p>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("py-2 px-4", className)}>
      <div className="py-2 space-y-1.5">
        {content}
        {description ? (
          <p className="text-sm text-muted-foreground leading-snug wrap-break-word">{description}</p>
        ) : null}
      </div>
    </Card>
  );
}
