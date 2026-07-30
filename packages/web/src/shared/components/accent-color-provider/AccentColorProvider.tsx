import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { type AccentColor, DEFAULT_ACCENT_COLOR, readAccentColor, writeAccentColor } from "@/shared/lib/accent-color";

interface AccentColorContextValue {
  accentColor: AccentColor;
  setAccentColor: (value: AccentColor) => void;
}

const AccentColorContext = createContext<AccentColorContextValue | null>(null);

function getInitialAccentColor(): AccentColor {
  try {
    return readAccentColor(window.localStorage);
  } catch {
    return DEFAULT_ACCENT_COLOR;
  }
}

export function AccentColorProvider({ children }: { children: React.ReactNode }) {
  const [accentColor, setAccentColor] = useState<AccentColor>(getInitialAccentColor);

  useEffect(() => {
    document.documentElement.dataset.accentColor = accentColor;
  }, [accentColor]);

  useEffect(() => {
    try {
      writeAccentColor(window.localStorage, accentColor);
    } catch {
      // The selected color remains available for the current session.
    }
  }, [accentColor]);

  const contextValue = useMemo(
    () => ({
      accentColor,
      setAccentColor,
    }),
    [accentColor]
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
