"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useId, useState } from "react";

import { useAccentColor } from "@/shared/components/accent-color-provider";
import { ACCENT_COLOR_OPTIONS } from "@/shared/lib/accent-color";
import { Segmented } from "@/shared/ui/segmented";
import { Tooltip } from "@/shared/ui/tooltip";
import { cn } from "@/shared/utils/cn";

type ThemeMode = "system" | "light" | "dark";

const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Auto",
  light: "Светлая",
  dark: "Тёмная",
};

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
  const { theme, setTheme } = useTheme();
  const { accentColor, isHydrated: isAccentColorHydrated, setAccentColor } = useAccentColor();
  const [mounted, setMounted] = useState(false);
  const accentColorGroupName = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme: ThemeMode =
    mounted && (theme === "system" || theme === "light" || theme === "dark") ? theme : "system";

  const optionClassName = showLabels ? "px-2" : "px-0";
  const getOptionLabel = (mode: ThemeMode) =>
    showLabels ? THEME_LABELS[mode] : <span className="sr-only">{THEME_LABELS[mode]}</span>;

  return (
    <div className={cn("space-y-4", className)}>
      {!!title && <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>}

      <Segmented
        className={cn("w-full", segmentedClassName)}
        disabled={!mounted}
        layout="fill"
        value={selectedTheme}
        onChange={(value) => setTheme(value)}
        options={[
          {
            value: "system",
            label: getOptionLabel("system"),
            icon: <Monitor />,
            className: optionClassName,
          },
          { value: "light", label: getOptionLabel("light"), icon: <Sun />, className: optionClassName },
          { value: "dark", label: getOptionLabel("dark"), icon: <Moon />, className: optionClassName },
        ]}
      />

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
