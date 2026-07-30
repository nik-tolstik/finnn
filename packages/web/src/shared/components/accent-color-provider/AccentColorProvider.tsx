import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type AccentColor, DEFAULT_ACCENT_COLOR, readAccentColor, writeAccentColor } from "@/shared/lib/accent-color";

interface AccentColorContextValue {
  accentColor: AccentColor;
  isHydrated: boolean;
  setAccentColor: (value: AccentColor) => void;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<AccentColor>(DEFAULT_ACCENT_COLOR);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      setAccentColor(readAccentColor(window.localStorage));
    } catch {
      setAccentColor(DEFAULT_ACCENT_COLOR);
    }
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.accentColor = accentColor;
  }, [accentColor]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    try {
      writeAccentColor(window.localStorage, accentColor);
    } catch {
      // The selected color remains available for the current session.
    }
  }, [accentColor, isHydrated]);

  const contextValue = useMemo(
    () => ({
      accentColor,
      isHydrated,
      setAccentColor,
    }),
    [accentColor, isHydrated]
  );

  return <AccentColorContext.Provider value={contextValue}>{children}</AccentColorContext.Provider>;
}

export function useAccentColor(): AccentColorContextValue {
  const context = useContext(AccentColorContext);

  if (!context) {
    throw new Error("useAccentColor must be used within AccentColorProvider");
  }

  return context;
}
