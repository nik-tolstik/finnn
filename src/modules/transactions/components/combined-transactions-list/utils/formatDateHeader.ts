import { format, isSameDay, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";

export function formatDateHeader(date: Date) {
  const today = startOfDay(new Date());
  const yesterday = startOfDay(new Date());

  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameDay(date, today)) {
    return "Сегодня";
  }

  if (isSameDay(date, yesterday)) {
    return "Вчера";
  }

  return format(date, "d MMMM yyyy", { locale: ru });
}
