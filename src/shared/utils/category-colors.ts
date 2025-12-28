/**
 * Предустановленная палитра цветов для категорий
 * Цвета радуги + коричневый, серый и белый
 */
export const CATEGORY_COLORS = [
  "#ef4444", // красный (red)
  "#f97316", // оранжевый (orange)
  "#eab308", // жёлтый (yellow)
  "#22c55e", // зелёный (green)
  "#06b6d4", // голубой (cyan/blue)
  "#3b82f6", // синий (blue)
  "#8b5cf6", // фиолетовый (purple/violet)
  "#ec4899", // розовый (pink/magenta)
  "#a855f7", // фиолетовый (violet)
  "#10b981", // изумрудный (emerald)
  "#14b8a6", // бирюзовый (teal)
  "#6366f1", // индиго (indigo)
  "#84cc16", // лайм (lime)
  "#78716c", // коричневый (brown/stone)
  "#6b7280", // серый (gray)
  "#ffffff", // белый (white)
];

/**
 * Генерирует случайный HEX цвет из предустановленной палитры
 */
export function generateRandomColor(): string {
  return CATEGORY_COLORS[Math.floor(Math.random() * CATEGORY_COLORS.length)];
}

/**
 * Генерирует случайный HEX цвет (полностью случайный)
 */
export function generateRandomColorFull(): string {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

