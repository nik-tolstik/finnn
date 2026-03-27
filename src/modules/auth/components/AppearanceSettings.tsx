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
}

export function AppearanceSettings({
  title = "Тема приложения",
  description = "Auto следует системной теме устройства.",
  className,
  segmentedClassName,
}: AppearanceSettingsProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedTheme: ThemeMode =
    mounted && (theme === "system" || theme === "light" || theme === "dark") ? theme : "system";

  const optionClassName = "px-2";

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
            label: THEME_LABELS.system,
            icon: <Monitor />,
            className: optionClassName,
          },
          { value: "light", label: THEME_LABELS.light, icon: <Sun />, className: optionClassName },
          { value: "dark", label: THEME_LABELS.dark, icon: <Moon />, className: optionClassName },
        ]}
      />
    </div>
  );
}
