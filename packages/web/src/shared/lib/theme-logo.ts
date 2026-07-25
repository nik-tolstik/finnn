const THEME_LOGO_PATHS = {
  light: "/logo-dark.svg",
  dark: "/logo-light.svg",
} as const;

export function getThemeLogoPath(theme: string | undefined): string | null {
  if (theme !== "light" && theme !== "dark") return null;

  return THEME_LOGO_PATHS[theme];
}
