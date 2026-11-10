import type { DayEntry } from "@/src/storage/storage";
import type { TagItem } from "@/src/data/defaultTags";
import { NOBODY_ID } from "@/src/data/people";

/**
 * Яркие моменты периода (недели, месяца, года) для экранов итогов:
 * гордость, открытия и люди. Слова «топ-3» в интерфейсе нет — просто
 * подборки. Считаем по готовым полям записи, ничего не угадываем.
 */

export interface HighlightQuote {
  date: string;
  text: string;
}

export type PersonHighlight = TagItem & { count: number };

/** «Чем горжусь» за период, новые первыми. */
export function topProud(entries: DayEntry[], limit: number): HighlightQuote[] {
  return entries
    .filter((e) => typeof e.proud === "string" && e.proud.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((e) => ({ date: e.date, text: e.proud.trim() }));
}

/** «Что узнал» за период, новые первыми. */
export function topLearned(entries: DayEntry[], limit: number): HighlightQuote[] {
  return entries
    .filter((e) => typeof e.answers?.learned === "string" && e.answers.learned.trim().length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((e) => ({ date: e.date, text: e.answers.learned.trim() }));
}

/**
 * Люди периода: сколько дней провели вместе. «Никого» не считаем — это
 * отсутствие людей, а не человек.
 */
export function topPeople(entries: DayEntry[], people: TagItem[], limit: number): PersonHighlight[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const id of new Set((e.people ?? []).filter((p) => p !== NOBODY_ID))) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => {
      const person = people.find((p) => p.id === id);
      return person ? { ...person, count } : null;
    })
    .filter((p): p is PersonHighlight => p !== null)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** Обрезка цитаты для компактных списков (месяц/год): одна строка. */
export function truncateHighlight(text: string, maxLength = 90): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > maxLength ? oneLine.slice(0, maxLength).trimEnd() + "…" : oneLine;
}
