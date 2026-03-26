/**
 * Preconfigured color palette for categories
 * Rainbow colors plus brown, gray, and white
 */
export const CATEGORY_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan/Blue
  "#3b82f6", // Blue
  "#8b5cf6", // Purple/Violet
  "#ec4899", // Pink/Magenta
  "#a855f7", // Violet
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#6366f1", // Indigo
  "#84cc16", // Lime
  "#78716c", // Brown/Stone
  "#6b7280", // Gray
  "#ffffff", // White
];

/**
 * Generate a random HEX color from the predefined palette
 */
export function generateRandomColor(): string {
  return CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
}

/**
 * Generate a random HEX color (fully random)
 */
export function generateRandomColorFull(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}
