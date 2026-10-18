import type { DayEntry } from "@/src/storage/storage";
import { isValidMood } from "@/src/utils/mood";
import {
  MONTHS_GENITIVE,
  addDays,
  entryQuoteWithSource,
  parseDay,
  type TagInfo,
} from "@/src/utils/entryText";

/**
 * Итоги недели показываем только при трёх записях и больше: по одной-двум
 * точкам «как менялось настроение» — это уже не наблюдение, а выдумка.
 */
export const WEEKLY_MIN_ENTRIES = 3;

export type WeekTone = "hard" | "mixed" | "good";

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  days: Array<{ date: string; mood: number | null }>;
  entryCount: number;
  avgMood: number;
  prevAvgMood: number | null;
  tone: WeekTone;
  brightest: { date: string; mood: number; quote: string | null; quoteSource: string | null } | null;
  topTags: Array<TagInfo & { count: number }>;
  extraQuote: { date: string; text: string; source: string } | null;
  tasks: { planned: number; done: number } | null;
}

/** Неделя начинается с понедельника. */
export function weekStartOf(dateStr: string): string {
  const dow = (parseDay(dateStr).getDay() + 6) % 7;
  return addDays(dateStr, -dow);
}

/**
 * Какую неделю подводить сегодня: в воскресенье — текущую, в понедельник и
 * вторник — только что закончившуюся, в остальные дни итогов нет. Три дня
 * окна дают шанс увидеть итоги и тем, кто заходит не каждый день.
 */
export function summaryWeekFor(todayStr: string): string | null {
  const dow = parseDay(todayStr).getDay();
  if (dow === 0) return weekStartOf(todayStr);
  if (dow === 1 || dow === 2) return weekStartOf(addDays(todayStr, -7));
  return null;
}

export function weeklyViewedKey(weekStart: string): string {
  return `weekly_summary_viewed_${weekStart}`;
}

export function formatWeekRange(weekStart: string): string {
  const start = parseDay(weekStart);
  const end = parseDay(addDays(weekStart, 6));
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
  }
  return `${start.getDate()} ${MONTHS_GENITIVE[start.getMonth()]} – ${end.getDate()} ${MONTHS_GENITIVE[end.getMonth()]}`;
}

function entriesOfWeek(all: DayEntry[], weekStart: string): DayEntry[] {
  const weekEnd = addDays(weekStart, 6);
  return all
    .filter((e) => e.date >= weekStart && e.date <= weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function buildWeeklySummary(
  all: DayEntry[],
  weekStart: string,
  tagInfo: (id: string) => TagInfo | null,
): WeeklySummary | null {
  const entries = entriesOfWeek(all, weekStart);
  if (entries.length < WEEKLY_MIN_ENTRIES) return null;

  const byDate = new Map(entries.map((e) => [e.date, e]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    const mood = byDate.get(date)?.mood;
    return { date, mood: isValidMood(mood) ? mood : null };
  });

  // Запись без оценки считается записью, но в настроение недели не входит.
  const moods = entries.map((e) => e.mood).filter(isValidMood);
  const avgMood = average(moods);
  const prevEntries = entriesOfWeek(all, addDays(weekStart, -7));
  const prevMoods = prevEntries.map((e) => e.mood).filter(isValidMood);
  const prevAvgMood = prevMoods.length >= WEEKLY_MIN_ENTRIES ? average(prevMoods) : null;
  const tone: WeekTone = avgMood <= 1.6 ? "hard" : avgMood >= 3.8 ? "good" : "mixed";

  // «Самый светлый» имеет смысл, только если дни различались: при одинаковом
  // настроении всю неделю выделять один из них было бы натяжкой.
  const maxMood = Math.max(...moods);
  const minMood = Math.min(...moods);
  const brightestEntry = maxMood > minMood
    ? [...entries].reverse().find((e) => e.mood === maxMood) ?? null
    : null;
  const brightest = brightestEntry
    ? (() => {
        const q = entryQuoteWithSource(brightestEntry, { maxLength: 160 });
        return { date: brightestEntry.date, mood: brightestEntry.mood, quote: q?.text ?? null, quoteSource: q?.source ?? null };
      })()
    : null;

  const tagCounts = new Map<string, number>();
  for (const e of entries) {
    for (const id of new Set([...e.places, ...e.activities])) {
      tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id, count]) => {
      const info = tagInfo(id);
      return info ? { ...info, count } : null;
    })
    .filter((t): t is TagInfo & { count: number } => t !== null)
    .slice(0, 3);

  // Вторая цитата — из другого, не тяжёлого дня: без спроса поднимать слова
  // из плохого дня в сводке было бы бестактно.
  const extraQuote = entries
    .filter((e) => e.date !== brightestEntry?.date && e.mood >= 3)
    .map((e) => {
      const q = entryQuoteWithSource(e, { maxLength: 160 });
      return q ? { date: e.date, text: q.text, source: q.source } : null;
    })
    .filter((q): q is { date: string; text: string; source: string } => q !== null)
    .sort((a, b) => b.text.length - a.text.length)[0] ?? null;

  const planned = entries.reduce((sum, e) => sum + (e.tasksForTomorrow?.length ?? 0), 0);
  const done = entries.reduce((sum, e) => sum + (e.tasksReviewed?.filter((t) => t.done).length ?? 0), 0);

  return {
    weekStart,
    weekEnd: addDays(weekStart, 6),
    days,
    entryCount: entries.length,
    avgMood,
    prevAvgMood,
    tone,
    brightest,
    topTags,
    extraQuote,
    tasks: planned > 0 ? { planned, done } : null,
  };
}

export function summaryHeadline(summary: WeeklySummary): string {
  if (summary.tone === "hard") return "Непростая неделя. Хорошо, что она записана.";
  if (summary.tone === "good") return "Хорошая неделя.";
  return "Неделя, в которой было разное.";
}

/** Сравнение без причин: только факт, что средняя оценка выше или ниже. */
export function summaryComparison(summary: WeeklySummary): string | null {
  if (summary.prevAvgMood === null) return null;
  const diff = summary.avgMood - summary.prevAvgMood;
  if (diff >= 0.5) return "Настроение лучше, чем неделей раньше.";
  if (diff <= -0.5) return "Настроение ниже, чем неделей раньше.";
  return "Настроение примерно как неделей раньше.";
}
