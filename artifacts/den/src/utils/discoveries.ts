import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodEmoji } from "@/src/components/MoodPicker";
import { formatDayMonth, type TagInfo } from "@/src/utils/entryText";
import { isValidMood } from "@/src/utils/mood";
import { NOBODY_ID } from "@/src/data/people";

/**
 * «Открытия о себе» — то, что Den замечает в записях на 3-й, 7-й, 14-й и
 * 30-й записи. Причина вернуться, которая не напоминалка: задача «понять,
 * кто я» у обеих аудиторий Den, подростков и взрослых.
 *
 * Только частоты и сравнения из записей самого человека, никаких «потому
 * что»: экран паттернов уже показал, что связи настроения с тегами на
 * реальных дневниках не выдерживают проверки. Тег «выделяется в хорошие
 * дни», только если он был хотя бы в двух хороших днях и встречается в них
 * чаще, чем в среднем, — иначе это совпадение.
 */
export const DISCOVERY_MILESTONES = [3, 7, 14, 30] as const;

export interface Discovery {
  milestone: number;
  text: string;
}

const GOOD_MOOD = 4;
const MIN_GOOD_HITS = 2;

type Label = (id: string) => TagInfo | null;

function featuresOf(e: DayEntry): string[] {
  const people = (e.people ?? []).filter((p) => p !== NOBODY_ID);
  return [...new Set([...e.places, ...e.activities, ...people])];
}

function quoted(ids: string[], labelOf: Label): string[] {
  return ids.map((id) => labelOf(id)?.label).filter((l): l is string => !!l).map((l) => `«${l}»`);
}

function average(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Самый частый признак окна, если он встретился хотя бы дважды. */
function topFeature(window: DayEntry[], labelOf: Label): { id: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of window) for (const f of featuresOf(e)) counts.set(f, (counts.get(f) ?? 0) + 1);
  const best = [...counts.entries()]
    .filter(([id, n]) => n >= 2 && labelOf(id))
    .sort((a, b) => b[1] - a[1])[0];
  return best ? { id: best[0], count: best[1] } : null;
}

/** Признаки, которые в хорошие дни встречаются чаще, чем в среднем по окну. */
function distinctiveInGoodDays(window: DayEntry[], labelOf: Label, only?: (id: string) => boolean): string[] {
  const good = window.filter((e) => e.mood >= GOOD_MOOD);
  if (good.length === 0) return [];
  const ids = new Set(window.flatMap(featuresOf));
  return [...ids]
    .filter((id) => labelOf(id) && (!only || only(id)))
    .map((id) => {
      const goodHits = good.filter((e) => featuresOf(e).includes(id)).length;
      const allHits = window.filter((e) => featuresOf(e).includes(id)).length;
      return { id, goodHits, lift: goodHits / good.length - allHits / window.length };
    })
    .filter((x) => x.goodHits >= MIN_GOOD_HITS && x.lift > 0)
    .sort((a, b) => b.lift - a.lift || b.goodHits - a.goodHits)
    .map((x) => x.id);
}

function brightestOf(window: DayEntry[]): DayEntry {
  return window.reduce((best, e) => (e.mood > best.mood ? e : best), window[0]);
}

function discovery3(sorted: DayEntry[], labelOf: Label): string {
  const first = sorted.slice(0, 3);
  if (first.every((e) => e.mood === first[0].mood)) {
    return `Первые три дня прошли ровно — все ${getMoodEmoji(first[0].mood)}. Посмотрим, что будет дальше.`;
  }
  const best = brightestOf(first);
  const head = `Самый светлый из первых трёх дней — ${formatDayMonth(best.date)} ${getMoodEmoji(best.mood)}.`;
  const what = quoted(featuresOf(best), labelOf).slice(0, 3);
  return what.length > 0 ? `${head} В тот день: ${what.join(", ")}.` : head;
}

function discovery7(sorted: DayEntry[], labelOf: Label): string {
  const window = sorted.slice(-7);
  const goodCount = window.filter((e) => e.mood >= GOOD_MOOD).length;
  const top = topFeature(window, labelOf);
  if (!top) return `За 7 записей дней на «Отлично» и «Супер» — ${goodCount} из 7.`;
  const topText = `За 7 записей чаще всего ты отмечаешь «${labelOf(top.id)!.label}» (${top.count} ${top.count < 5 ? "раза" : "раз"}).`;
  const distinct = distinctiveInGoodDays(window, labelOf).find((id) => id !== top.id);
  return distinct
    ? `${topText} В хорошие дни чаще встречается «${labelOf(distinct)!.label}».`
    : `${topText} Дней на «Отлично» и «Супер» — ${goodCount} из 7.`;
}

function discovery14(sorted: DayEntry[], labelOf: Label, isPerson: (id: string) => boolean): string {
  const window = sorted.slice(-14);
  const diff = average(window.slice(7).map((e) => e.mood)) - average(window.slice(0, 7).map((e) => e.mood));
  const trend =
    diff >= 0.5
      ? "Последние 7 записей светлее предыдущих."
      : diff <= -0.5
        ? "Последние дни были тяжелее, чем раньше. Хорошо, что они записаны."
        : "Настроение две недели держится ровно.";
  const person = distinctiveInGoodDays(window, labelOf, isPerson)[0];
  return person ? `${trend} В лучшие дни чаще встречается «${labelOf(person)!.label}».` : trend;
}

function discovery30(sorted: DayEntry[], labelOf: Label): string {
  const window = sorted.slice(-30);
  const good = window.filter((e) => e.mood >= GOOD_MOOD);
  const counts = new Map<string, number>();
  for (const e of good) for (const f of featuresOf(e)) counts.set(f, (counts.get(f) ?? 0) + 1);
  const typical = [...counts.entries()]
    .filter(([id, n]) => n >= MIN_GOOD_HITS && labelOf(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => id);
  const goodText = `Дней на «Отлично» и «Супер» — ${good.length} из последних ${window.length}.`;
  if (typical.length > 0) {
    return `Месяц записей. Твой обычный хороший день: ${quoted(typical, labelOf).join(", ")}. ${goodText}`;
  }
  const best = brightestOf(window);
  return `Месяц записей. ${goodText.slice(0, -1)}, самый светлый — ${formatDayMonth(best.date)} ${getMoodEmoji(best.mood)}.`;
}

/**
 * Открытие для экрана «День записан», если дневник дошёл до очередной
 * отметки, а её открытие ещё не показывалось. Если пропущено несколько
 * отметок сразу (обновились с длинным дневником), показываем самую старшую.
 * В тяжёлый день («Плохо») молчим: открытие подождёт следующего вечера, говорить
 * о хороших днях в плохой — не к месту.
 *
 * `all` — все записи, включая только что сохранённую.
 */
export function pickDiscovery(
  entry: DayEntry,
  all: DayEntry[],
  labelOf: Label,
  isPerson: (id: string) => boolean,
  shownMilestones: number[],
): Discovery | null {
  if (!isValidMood(entry.mood) || entry.mood === 1) return null;
  const byDate = new Map(all.map((e) => [e.date, e]));
  byDate.set(entry.date, entry);
  const sorted = [...byDate.values()].filter((e) => isValidMood(e.mood)).sort((a, b) => a.date.localeCompare(b.date));
  const pending = DISCOVERY_MILESTONES.filter((m) => m <= sorted.length && !shownMilestones.includes(m));
  if (pending.length === 0) return null;
  const milestone = pending[pending.length - 1];
  const text =
    milestone === 3 ? discovery3(sorted, labelOf)
    : milestone === 7 ? discovery7(sorted, labelOf)
    : milestone === 14 ? discovery14(sorted, labelOf, isPerson)
    : discovery30(sorted, labelOf);
  return { milestone, text };
}

// Какие отметки уже показаны. Ключ не должен начинаться с «day_» — так
// называются записи дневника (урок v25).
const SHOWN_DISCOVERIES_KEY = "discoveries_shown";

export async function readShownDiscoveries(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(SHOWN_DISCOVERIES_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

/** Показанная отметка закрывает и все младшие, чтобы они не всплыли потом. */
export async function rememberDiscovery(milestone: number, shown: number[]): Promise<void> {
  const next = [...new Set([...shown, ...DISCOVERY_MILESTONES.filter((m) => m <= milestone)])];
  try {
    await AsyncStorage.setItem(SHOWN_DISCOVERIES_KEY, JSON.stringify(next));
  } catch {}
}
