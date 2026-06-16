"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Segmented } from "@/shared/ui/segmented";
import { cn } from "@/shared/utils/cn";

type ThemeMode = "system" | "light" | "dark";

const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Auto",
  light: "Светлая",
  dark: "Тёмная",
};

interface AppearanceSettingsProps {
  title?: string | null;
  description?: string | null;
  className?: string;
  segmentedClassName?: string;
  showLabels?: boolean;
}

export function AppearanceSettings({
  title = "Тема приложения",
  description = "Auto следует системной теме устройства.",
  className,
  segmentedClassName,
  showLabels = true,
}: AppearanceSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
      {(title || description) && (
        <div className="space-y-1">
          {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
      )}

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
    </div>
  );
}
