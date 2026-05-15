"use client";

import type { ReactNode } from "react";

import { Card } from "@/shared/ui/card";
import { cn } from "@/shared/utils/cn";
import { hexToRgba } from "@/shared/utils/color-utils";

import type { AccountSegmentType, DescriptionSegment } from "../../utils/transactionDescription";

export type AccountChipData = { color: string | null; icon: ReactNode; label?: string };

export type AccountChipsMap = Partial<Record<AccountSegmentType, AccountChipData>>;

export interface TransactionLineAmount {
  text: ReactNode;
  className?: string;
  secondaryText?: ReactNode;
  secondaryClassName?: string;
}

interface TransactionLineFooter {
  icon?: ReactNode;
  chips?: AccountChipData[];
  chipSeparator?: ReactNode;
  layout?: "right" | "between" | "stackedRight";
  trailing?: TransactionLineAmount;
}

interface TransactionDescriptionLineProps {
  segments: DescriptionSegment[];
  icon?: ReactNode;
  accountChips?: AccountChipsMap;
  amount?: TransactionLineAmount;
  footer?: TransactionLineFooter;
  descriptionPlacement?: "inline" | "below";
  description?: string;
  onClick?: () => void;
  className?: string;
}

export function TransactionDescriptionLine({
  segments,
  icon,
  accountChips,
  amount,
  footer,
  descriptionPlacement = "inline",
  description,
  onClick,
  className,
}: TransactionDescriptionLineProps) {
  const [firstSegment, ...restSegments] = segments;
  const renderAccountChip = (label: string, chip: AccountChipData, key?: string | number) => (
    <span
      key={key}
      className={cn(
        "inline-flex max-w-44 items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-foreground",
        !chip.color && "bg-muted"
      )}
      style={{
        borderColor: chip.color ? hexToRgba(chip.color, 0.5) : undefined,
        backgroundColor: chip.color ? hexToRgba(chip.color, 0.08) : undefined,
      }}
    >
      <span className="shrink-0" style={{ color: chip.color ?? undefined }}>
        {chip.icon}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
  const content = (
    <span className="text-sm leading-relaxed inline-flex flex-wrap items-center gap-x-1 gap-y-1.5">
      <span className="inline-flex items-center gap-1">
        {icon ? <span className="text-muted-foreground [&>svg]:size-4">{icon}</span> : null}
        <span className={firstSegment?.highlight ? "font-semibold" : undefined}>{firstSegment?.text ?? ""}</span>
      </span>
      {restSegments.map((seg, i) => {
        const chip = seg.segmentType && seg.segmentType !== "category" && accountChips?.[seg.segmentType];
        if (seg.segmentType === "category") {
          return (
            <span key={i} className="inline-flex font-semibold">
              {seg.text}
            </span>
          );
        }
        if (chip) {
          return renderAccountChip(seg.text, chip, i);
        }
        return (
          <span key={i} className="inline-flex items-center gap-1">
            {seg.highlight ? <span className="font-semibold">{seg.text}</span> : <span>{seg.text}</span>}
          </span>
        );
      })}
    </span>
  );
  const footerChips = footer?.chips?.map((chip, index) => {
    if (!chip.label) return null;

    return (
      <span key={index} className="inline-flex items-center gap-1.5">
        {index > 0 && footer.chipSeparator ? (
          <span className="text-muted-foreground [&>svg]:size-3.5">{footer.chipSeparator}</span>
        ) : null}
        {renderAccountChip(chip.label, chip)}
      </span>
    );
  });
  const footerIcon = footer?.icon ? <span className="[&>svg]:size-4">{footer.icon}</span> : null;
  const footerTrailing = footer?.trailing ? (
    <span
      className={cn(
        "ml-auto shrink-0 text-right text-sm font-semibold leading-relaxed tabular-nums break-words",
        footer.trailing.className
      )}
    >
      {footer.trailing.text}
    </span>
  ) : null;
  const footerContent =
    footerIcon || footerChips?.length || footerTrailing ? (
      footer?.layout === "stackedRight" ? (
        <div className="space-y-2 text-muted-foreground">
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">{footerChips}</div>
          {footerIcon ? <div className="flex justify-end">{footerIcon}</div> : null}
          {footerTrailing ? <div className="flex justify-end">{footerTrailing}</div> : null}
        </div>
      ) : footer?.layout === "between" ? (
        <div className="flex min-w-0 items-center justify-between gap-3 text-muted-foreground">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">{footerChips}</span>
          <span className="ml-auto shrink-0">{footerTrailing ?? footerIcon}</span>
        </div>
      ) : footerTrailing ? (
        <div className="flex min-w-0 items-center justify-between gap-3 text-muted-foreground">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {footerIcon}
            {footerChips}
          </span>
          {footerTrailing}
        </div>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-muted-foreground">
          {footerIcon}
          {footerChips}
        </div>
      )
    ) : null;
  const inlineDetails =
    description && footerContent ? (
      <div className="-mx-3 flex items-center justify-between gap-3 border-t border-border px-3 pt-2 sm:-mx-4 sm:px-4">
        <p className="min-w-0 text-xs text-muted-foreground leading-snug wrap-break-word">{description}</p>
        {footerContent}
      </div>
    ) : (
      (footerContent ??
      (description ? (
        <p className="border-t border-border mt-2 pt-2 text-xs text-muted-foreground leading-snug wrap-break-word">
          {description}
        </p>
      ) : null))
    );
  const belowDetails =
    footerContent || description ? (
      <div className="space-y-2">
        {footerContent}
        {description ? (
          <p className="border-t border-border mt-2 pt-2 text-xs text-muted-foreground leading-snug wrap-break-word">
            {description}
          </p>
        ) : null}
      </div>
    ) : null;
  const details = descriptionPlacement === "below" ? belowDetails : inlineDetails;
  const amountClassName =
    "shrink-0 max-w-[45%] text-right text-sm font-semibold leading-relaxed tabular-nums break-words sm:max-w-none";
  const amountContent = amount ? <span className={cn(amountClassName, amount.className)}>{amount.text}</span> : null;

  if (onClick) {
    return (
      <Card
        className={cn("cursor-pointer p-3 transition-colors hover:bg-accent/70 sm:p-4", className)}
        onClick={onClick}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">{content}</div>
            {amountContent}
          </div>
          {details}
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("px-3 py-2 sm:px-4", className)}>
      <div className="space-y-2 py-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{content}</div>
          {amountContent}
        </div>
        {details}
      </div>
    </Card>
  );
}
