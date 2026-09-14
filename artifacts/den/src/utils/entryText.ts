import { formatDate } from "@/src/storage/storage";
import type { DayEntry, UserTags } from "@/src/storage/storage";

export const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const WEEKDAYS_CAPITAL = [
  "Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота",
];

export type TagInfo = { emoji: string; label: string };

/** Полдень, а не полночь: переход на летнее время не сдвигает дату. */
export function parseDay(dateStr: string): Date {
  return new Date(dateStr + "T12:00:00");
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDay(dateStr);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((parseDay(toDate).getTime() - parseDay(fromDate).getTime()) / 86400000);
}

export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

export function formatDayMonth(dateStr: string): string {
  const d = parseDay(dateStr);
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

/**
 * Первая содержательная строка записи. Сначала то, что человек написал сам и
 * по своей воле (заметки, «горжусь»), потом ответы на заданные вопросы — они
 * бывают дежурными. Короткие обрывки вроде «ок» цитатой не считаются.
 */
export function entryQuote(entry: DayEntry, maxLength = 90): string | null {
  const candidates = [
    entry.notes,
    entry.proud,
    entry.answers?.positive?.answer,
    entry.answers?.learned,
    entry.answers?.met,
    entry.answers?.dayQuestion,
  ];
  for (const raw of candidates) {
    const firstLine = raw?.trim().split("\n")[0]?.trim();
    if (!firstLine || firstLine.length < 8) continue;
    return firstLine.length > maxLength ? firstLine.slice(0, maxLength - 1).trimEnd() + "…" : firstLine;
  }
  return null;
}

/** В записи хранятся id тегов, а подписи живут в пользовательском справочнике. */
export function tagLookup(tags: UserTags): (id: string) => TagInfo | null {
  const all = [...tags.places, ...tags.activities];
  return (id) => {
    const tag = all.find((t) => t.id === id);
    return tag ? { emoji: tag.emoji, label: tag.label } : null;
  };
}
