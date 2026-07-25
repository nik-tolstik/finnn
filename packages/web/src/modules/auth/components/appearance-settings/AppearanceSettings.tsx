"use client";

import { useId } from "react";

import { useAccentColor } from "@/shared/components/accent-color-provider";
import { ACCENT_COLOR_OPTIONS } from "@/shared/lib/accent-color";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

import { ThemeSelector } from "./ThemeSelector";

interface AppearanceSettingsProps {
  title?: string | null;
  className?: string;
  segmentedClassName?: string;
  showLabels?: boolean;
}

export function AppearanceSettings({
  title = "Тема приложения",
  className,
  segmentedClassName,
  showLabels = true,
}: AppearanceSettingsProps) {
  const { accentColor, isHydrated: isAccentColorHydrated, setAccentColor } = useAccentColor();
  const accentColorGroupName = useId();

  return (
    <div className={cn("space-y-4", className)}>
      <ThemeSelector title={title} segmentedClassName={segmentedClassName} showLabels={showLabels} layout="fill" />

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground">Основной цвет</h3>
        <div
          className={cn("flex items-center gap-3", !isAccentColorHydrated && "opacity-60")}
          role="radiogroup"
          aria-label="Основной цвет приложения"
          aria-disabled={!isAccentColorHydrated}
        >
          {ACCENT_COLOR_OPTIONS.map((option) => (
            <Tooltip key={option.value} content={option.label} delayDuration={0} disableHoverableContent>
              <label
                className={cn(
                  "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-transform hover:scale-105",
                  isAccentColorHydrated ? "cursor-pointer" : "cursor-default"
                )}
              >
                <input
                  type="radio"
                  name={`accent-color-${accentColorGroupName}`}
                  value={option.value}
                  checked={accentColor === option.value}
                  aria-label={option.label}
                  disabled={!isAccentColorHydrated}
                  onChange={() => setAccentColor(option.value)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  data-accent-swatch={option.value}
                  className={cn(
                    "appearance-color-swatch size-4 rounded-full shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-control-focus/40 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
                    accentColor === option.value && "ring-2 ring-foreground/80 ring-offset-2 ring-offset-background"
                  )}
                />
              </label>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  );
}
