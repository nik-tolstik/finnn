import "@fontsource-variable/onest";

import type { Decorator, Preview } from "@storybook/react-vite";
import { type ReactNode, useEffect, useState } from "react";
import { MemoryRouter } from "react-router";

import "../src/styles/globals.css";

type StorybookTheme = "system" | "light" | "dark";

const systemDarkThemeQuery = "(prefers-color-scheme: dark)";

function resolveTheme(theme: StorybookTheme): "light" | "dark" {
  if (theme === "light" || theme === "dark") {
    return theme;
  }

  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia(systemDarkThemeQuery).matches ? "dark" : "light";
}

function useResolvedStorybookTheme(theme: StorybookTheme) {
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">(() => resolveTheme(theme));

  useEffect(() => {
    setResolvedTheme(resolveTheme(theme));

    if (theme !== "system" || typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(systemDarkThemeQuery);
    const handleChange = () => {
      setResolvedTheme(resolveTheme("system"));
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme]);

  return resolvedTheme;
}

function StorybookThemeSync({ children, theme }: { children: ReactNode; theme: StorybookTheme }) {
  const resolvedTheme = useResolvedStorybookTheme(theme);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.classList.remove("light", "dark");
    root.classList.add(resolvedTheme);
    root.style.colorScheme = resolvedTheme;

    body.classList.add("bg-background", "font-sans", "text-foreground", "antialiased");
  }, [resolvedTheme]);

  return <StorybookShell>{children}</StorybookShell>;
}

function StorybookShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background p-4 font-sans text-foreground antialiased sm:p-6">
      <div className="mx-auto w-full max-w-5xl">{children}</div>
    </div>
  );
}

const withFinnnTheme: Decorator = (Story, context) => {
  const themeOverride = context.parameters.themes?.themeOverride;
  const theme = themeOverride || context.globals.theme;
  const storybookTheme = theme === "light" || theme === "dark" || theme === "system" ? theme : "system";

  return (
    <StorybookThemeSync theme={storybookTheme}>
      <Story />
    </StorybookThemeSync>
  );
};

const withRouter: Decorator = (Story) => (
  <MemoryRouter>
    <Story />
  </MemoryRouter>
);

const preview: Preview = {
  decorators: [withRouter, withFinnnTheme],
  globalTypes: {
    theme: {
      name: "Theme",
      description: "Finnn color theme",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "system", title: "Auto" },
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: {
    theme: "system",
  },
  parameters: {
    a11y: {
      test: "todo",
    },
    backgrounds: {
      options: {
        app: { name: "App", value: "#f7f9fc" },
        dark: { name: "Dark", value: "#171717" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
