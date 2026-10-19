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
 * Первая содержательная строка записи, порядок — как в quoteCandidates.
 * Короткие обрывки вроде «ок» цитатой не считаются.
 */
export function entryQuote(entry: DayEntry, maxLength = 90): string | null {
  return entryQuoteWithSource(entry, { maxLength })?.text ?? null;
}

/**
 * Цитата вместе с тем, на что она была ответом. «Получился вкусный суп» без
 * вопроса через месяц читается как обрывок — человек и сам не вспомнит, о
 * чём это. `source` — полный вопрос для экранов, где есть место; `shortSource`
 * — короткая метка для уведомления.
 */
export type QuoteKind = "dayQuestion" | "positive" | "proud" | "learned" | "met" | "notes";

export interface QuoteWithSource {
  kind: QuoteKind;
  text: string;
  source: string;
  shortSource: string;
}

const LEARNED_QUESTION = "Что сегодня удалось узнать?";
const MET_QUESTION = "Кого сегодня довелось встретить или вспомнить?";

function quoteCandidates(entry: DayEntry): Array<{ kind: QuoteKind; raw: string | undefined; source: string; shortSource: string }> {
  const positiveQuestion = entry.answers?.positive?.question?.trim() || "Что порадовало?";
  const dayQuestion = entry.question?.trim() || "Вопрос дня";
  // Первым — ответ на вопрос дня: вопрос каждый день новый, и именно его
  // ответ интереснее всего перечитывать. Подпись «Заметки» или «Гордость
  // дня» почти ничего не добавляет, поэтому они идут запасными.
  return [
    { kind: "dayQuestion", raw: entry.answers?.dayQuestion, source: dayQuestion, shortSource: "вопрос дня" },
    { kind: "positive", raw: entry.answers?.positive?.answer, source: positiveQuestion, shortSource: "хороший момент" },
    { kind: "proud", raw: entry.proud, source: "Гордость дня", shortSource: "гордость дня" },
    { kind: "learned", raw: entry.answers?.learned, source: LEARNED_QUESTION, shortSource: "новое за день" },
    { kind: "met", raw: entry.answers?.met, source: MET_QUESTION, shortSource: "встречи" },
    { kind: "notes", raw: entry.notes, source: "Заметки", shortSource: "заметки" },
  ];
}

function firstLineOf(raw: string | undefined): string | null {
  const line = raw?.trim().split("\n")[0]?.trim();
  return line || null;
}

function clip(text: string, maxLength: number): string {
  return text.length > maxLength ? text.slice(0, maxLength - 1).trimEnd() + "…" : text;
}

/**
 * Первая содержательная строка записи с её источником: сначала ответ на
 * вопрос дня, остальное — запасное (см. quoteCandidates).
 * `minLength` отсекает обрывки вроде «ок»; карточке вчерашнего дня хватает
 * и короткого «Очень хорошо», поэтому порог настраивается.
 */
export function entryQuoteWithSource(
  entry: DayEntry,
  { maxLength = 90, minLength = 8 }: { maxLength?: number; minLength?: number } = {},
): QuoteWithSource | null {
  for (const c of quoteCandidates(entry)) {
    const line = firstLineOf(c.raw);
    if (!line || line.length < minLength) continue;
    return { kind: c.kind, text: clip(line, maxLength), source: c.source, shortSource: c.shortSource };
  }
  return null;
}

/**
 * Для карточек, где пустое место хуже короткой цитаты: сначала ищем
 * содержательный ответ (от 8 символов), и только если его нет нигде — берём
 * короткий вроде «Очень хорошо». Иначе «ок» на вопрос дня перебивал бы
 * длинную заметку только потому, что вопрос дня идёт первым.
 */
export function entryQuoteForCard(entry: DayEntry, maxLength = 90): QuoteWithSource | null {
  return entryQuoteWithSource(entry, { maxLength }) ?? entryQuoteWithSource(entry, { maxLength, minLength: 1 });
}

/** Все подходящие цитаты записи — для уведомления, которое выбирает случайную. */
export function allQuotesWithSource(entry: DayEntry, maxLength = 100): QuoteWithSource[] {
  return quoteCandidates(entry)
    .map((c) => ({ line: firstLineOf(c.raw), c }))
    .filter((x): x is { line: string; c: (typeof x)["c"] } => !!x.line && x.line.length >= 8)
    .map(({ line, c }) => ({ kind: c.kind, text: clip(line, maxLength), source: c.source, shortSource: c.shortSource }));
}

/** В записи хранятся id тегов, а подписи живут в пользовательском справочнике. */
export function tagLookup(tags: UserTags): (id: string) => TagInfo | null {
  const all = [...tags.places, ...tags.activities];
  return (id) => {
    const tag = all.find((t) => t.id === id);
    return tag ? { emoji: tag.emoji, label: tag.label } : null;
  };
}
