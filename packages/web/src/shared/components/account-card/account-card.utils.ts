import { getAccountIconColors } from "@/shared/utils/account-icon-colors";

export function getLightThemeIconColor(hex: string): string {
  return getAccountIconColors(hex).light;
}
