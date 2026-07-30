import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { Segmented } from "@/shared/ui/segmented";
import { cn } from "@/shared/utils/cn";

type ThemeMode = "system" | "light" | "dark";

const THEME_LABELS: Record<ThemeMode, string> = {
  system: "Система",
  light: "Светлая",
  dark: "Тёмная",
};

interface ThemeSelectorProps {
  title?: string | null;
  segmentedClassName?: string;
  showLabels?: boolean;
  layout?: "fit" | "fill";
}

export function ThemeSelector({
  title = "Тема приложения",
  segmentedClassName,
  showLabels = true,
  layout = "fill",
}: ThemeSelectorProps) {
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
    <>
      {!!title && <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>}

      <Segmented
        className={cn("w-full", segmentedClassName)}
        disabled={!mounted}
        layout={layout}
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
    </>
  );
}
