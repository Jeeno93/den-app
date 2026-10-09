import AsyncStorage from "@react-native-async-storage/async-storage";
import { formatDate } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodEmoji } from "@/src/components/MoodPicker";
import { STREAK_MILESTONES } from "@/src/data/streakBadges";
import {
  addDays,
  daysBetween,
  formatDayMonth,
  parseDay,
  plural,
  type TagInfo,
} from "@/src/utils/entryText";
import { WEEKLY_MIN_ENTRIES, weekStartOf } from "@/src/utils/weeklySummary";

export interface DayReply {
  /** Уходит в аналитику, чтобы видеть, какие реплики вообще выпадают. */
  id: string;
  text: string;
}

const WEEKDAY_FORMS: Record<number, { third: string; noun: string }> = {
  0: { third: "Третье", noun: "воскресенье" },
  1: { third: "Третий", noun: "понедельник" },
  2: { third: "Третий", noun: "вторник" },
  3: { third: "Третья", noun: "среда" },
  4: { third: "Третий", noun: "четверг" },
  5: { third: "Третья", noun: "пятница" },
  6: { third: "Третья", noun: "суббота" },
};

const ENTRY_COUNT_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 365, 500, 730, 1000];

// «N-й день подряд» каждый вечер быстро перестают читать, поэтому серия
// отмечается только на отдельных днях. Круглые серии отмечает плашка
// достижения, их здесь нет.
const STREAK_REPLY_DAYS = [5, 10, 14, 21];

function isStreakReplyDay(streak: number): boolean {
  if ((STREAK_MILESTONES as readonly number[]).includes(streak)) return false;
  return STREAK_REPLY_DAYS.includes(streak) || (streak > 30 && streak % 10 === 0);
}

// Тег, который стоит в большинстве записей, — рутина: «третья среда подряд
// ты отмечаешь «Работа»» не открытие. Считаем только у тех, кто пишет
// достаточно часто, иначе у пишущих раз в неделю любой тег выглядел бы рутиной.
const ROUTINE_WINDOW_DAYS = 28;
const ROUTINE_MIN_ENTRIES = 8;
const ROUTINE_SHARE = 0.5;

// Вчерашний день до полудня ещё «свой»: его дописывают после полуночи или
// утром по горячим следам, и реплика к нему так же уместна, как к сегодняшнему.
// Более поздние и давние дни — архив, там реплика звучала бы странно.
const FRESH_UNTIL_HOUR = 12;

export function isFreshDay(date: string, now: Date = new Date()): boolean {
  const today = formatDate(now);
  if (date === today) return true;
  return date === addDays(today, -1) && now.getHours() < FRESH_UNTIL_HOUR;
}

function daysWord(n: number): string {
  return plural(n, ["день", "дня", "дней"]);
}

function agoPhrase(days: number): string {
  if (days === 2) return "Позавчера";
  if (days === 7) return "Неделю назад";
  return `${days} ${daysWord(days)} назад`;
}

/**
 * Реплика на экране «День записан».
 *
 * Сейчас приложение молча хранит записи, и на второй день ему нечего сказать
 * — ровно там теряется больше всего людей. Реплика — первое, что продукт
 * говорит в ответ. Правила жёсткие: только факты из записей самого человека,
 * никаких причинно-следственных утверждений (урок экрана паттернов, где
 * корреляции не пережили проверку) и ничего бодрого в тяжёлый день.
 *
 * Подходящие правила собираются по порядку, от более редкого и личного к
 * общему. Реплика, показанная вчера, второй вечер подряд не повторяется:
 * берётся следующая, а если другой нет — лучше промолчать.
 *
 * `all` — все записи, включая только что сохранённую;
 * `yesterdayReplyId` — id реплики, показанной вчера, если была.
 */
export function pickDayReply(
  entry: DayEntry,
  all: DayEntry[],
  tagInfo: (id: string) => TagInfo | null,
  yesterdayReplyId: string | null = null,
): DayReply | null {
  const today = entry.date;
  const byDate = new Map(all.map((e) => [e.date, e]));
  byDate.set(today, entry);
  const dates = [...byDate.keys()].sort();
  const count = dates.length;
  const earlier = dates.filter((d) => d < today);
  const prev = earlier.length > 0 ? byDate.get(earlier[earlier.length - 1])! : null;

  let streak = 1;
  while (byDate.has(addDays(today, -streak))) streak++;

  // Первый и второй день: главное — пообещать, ради чего возвращаться.
  if (count === 1) {
    return {
      id: "first_entry",
      text: entry.mood <= 2
        ? "Первая запись есть. Начать с непростого дня — это нормально. Через неделю покажем, как менялось настроение."
        : "Первая запись есть. Через неделю покажем, как менялось твоё настроение.",
    };
  }
  if (count === 2 && prev) {
    if (streak >= 2) {
      return {
        id: "second_in_row",
        text: `Второй день подряд. Вчера ${getMoodEmoji(prev.mood)}, сегодня ${getMoodEmoji(entry.mood)}.`,
      };
    }
    return {
      id: "second_entry",
      text: `Вторая запись. ${agoPhrase(daysBetween(prev.date, today))} было ${getMoodEmoji(prev.mood)}, сегодня ${getMoodEmoji(entry.mood)}.`,
    };
  }

  const candidates: DayReply[] = [];
  const pick = () => candidates.find((c) => c.id !== yesterdayReplyId) ?? null;

  // Тяжёлый день: только поддержка, и только если за ней стоит факт из
  // его же дневника. «Самые светлые дни» и счётчики тут неуместны.
  if (entry.mood <= 2) {
    for (let i = earlier.length - 1; i >= 0; i--) {
      const low = byDate.get(earlier[i])!;
      if (low.mood > 2) continue;
      const better = earlier
        .slice(i + 1)
        .map((d) => byDate.get(d)!)
        .find((e) => daysBetween(low.date, e.date) <= 7 && e.mood > low.mood);
      if (!better) continue;
      const gap = daysBetween(low.date, better.date);
      const when = gap === 1 ? "На следующий день" : `Через ${gap} ${daysWord(gap)}`;
      candidates.push({ id: "low_then_better", text: `Похожий день был ${formatDayMonth(low.date)}. ${when} стало лучше.` });
      break;
    }
    candidates.push({ id: "low_written", text: "Записать тяжёлый день — тоже забота о себе." });
    return pick();
  }

  const dow = parseDay(today).getDay();
  const tagsOf = (e: DayEntry | undefined) => (e ? [...e.places, ...e.activities] : []);

  // Тег в этот день недели три недели подряд — один раз на серию: на
  // четвёртой неделе это уже не новость. Рутинные теги не считаются.
  const recent = dates
    .filter((d) => daysBetween(d, today) < ROUTINE_WINDOW_DAYS)
    .map((d) => byDate.get(d)!);
  const isRoutine = (id: string) =>
    recent.length >= ROUTINE_MIN_ENTRIES &&
    recent.filter((e) => tagsOf(e).includes(id)).length / recent.length > ROUTINE_SHARE;
  for (const id of new Set(tagsOf(entry))) {
    let weeks = 1;
    while (tagsOf(byDate.get(addDays(today, -7 * weeks))).includes(id)) weeks++;
    if (weeks !== 3 || isRoutine(id)) continue;
    const info = tagInfo(id);
    if (!info) continue;
    const forms = WEEKDAY_FORMS[dow];
    candidates.push({ id: "weekday_tag", text: `${forms.third} ${forms.noun} подряд ты отмечаешь «${info.label}».` });
    break;
  }

  const lastMonth = earlier.filter((d) => daysBetween(d, today) <= 30).map((d) => byDate.get(d)!);
  if (entry.mood >= 4 && lastMonth.length >= 5 && lastMonth.every((e) => e.mood < entry.mood)) {
    candidates.push({ id: "brightest_month", text: "Самый светлый день за последний месяц." });
  }

  if (streak >= 4 && isStreakReplyDay(streak)) {
    candidates.push({ id: "streak", text: `${streak}-й день подряд.` });
  }

  if (ENTRY_COUNT_MILESTONES.includes(count)) {
    candidates.push({ id: "entry_count", text: `Это ${count}-я запись в дневнике.` });
  }

  // Запасной вариант: связать сегодняшнюю запись с итогами недели.
  const weekStart = weekStartOf(today);
  const weekCount = dates.filter((d) => d >= weekStart && d <= today).length;
  if (dow === 0) {
    if (weekCount >= WEEKLY_MIN_ENTRIES) {
      candidates.push({ id: "weekly_ready", text: "Итоги недели готовы, они на главном экране." });
    }
  } else if (weekCount >= WEEKLY_MIN_ENTRIES) {
    // Только в вечер, когда записей стало хватать: дальше это уже не новость,
    // а у пишущих каждый день она выпадала бы через вечер до воскресенья.
    if (weekCount === WEEKLY_MIN_ENTRIES) {
      candidates.push({ id: "weekly_soon", text: "В воскресенье соберём итоги твоей недели." });
    }
  } else {
    const needed = WEEKLY_MIN_ENTRIES - weekCount;
    const daysLeftInWeek = 6 - ((dow + 6) % 7);
    if (needed <= daysLeftInWeek) {
      candidates.push({
        id: "weekly_progress",
        text: `Ещё ${needed} ${plural(needed, ["запись", "записи", "записей"])} на этой неделе, и в воскресенье будут итоги.`,
      });
    }
  }

  return pick();
}

// Какая реплика показывалась в какой день — чтобы не повторить вчерашнюю.
// Ключ не должен начинаться с «day_»: так называются записи дневника.
const SHOWN_REPLIES_KEY = "replies_shown_by_day";
// Под этим именем ключ жил в тестовых сборках v25 и попадал в дневник.
const LEGACY_SHOWN_REPLIES_KEY = "day_replies_shown";
const SHOWN_REPLIES_KEEP = 7;

export async function readShownReplies(): Promise<Record<string, string>> {
  try {
    let raw = await AsyncStorage.getItem(SHOWN_REPLIES_KEY);
    const legacy = await AsyncStorage.getItem(LEGACY_SHOWN_REPLIES_KEY);
    if (legacy !== null) {
      if (raw === null) {
        raw = legacy;
        await AsyncStorage.setItem(SHOWN_REPLIES_KEY, legacy);
      }
      await AsyncStorage.removeItem(LEGACY_SHOWN_REPLIES_KEY);
    }
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export async function rememberShownReply(
  date: string,
  id: string,
  shown: Record<string, string>,
): Promise<void> {
  const next = { ...shown, [date]: id };
  const kept = Object.keys(next).sort().slice(-SHOWN_REPLIES_KEEP);
  try {
    await AsyncStorage.setItem(
      SHOWN_REPLIES_KEY,
      JSON.stringify(Object.fromEntries(kept.map((d) => [d, next[d]]))),
    );
  } catch {}
}
