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

const WEEKDAY_FORMS: Record<number, { second: string; third: string; noun: string }> = {
  0: { second: "Второе", third: "Третье", noun: "воскресенье" },
  1: { second: "Второй", third: "Третий", noun: "понедельник" },
  2: { second: "Второй", third: "Третий", noun: "вторник" },
  3: { second: "Вторая", third: "Третья", noun: "среда" },
  4: { second: "Второй", third: "Третий", noun: "четверг" },
  5: { second: "Вторая", third: "Третья", noun: "пятница" },
  6: { second: "Вторая", third: "Третья", noun: "суббота" },
};

const ENTRY_COUNT_MILESTONES = [10, 25, 50, 100, 150, 200, 300, 365, 500, 730, 1000];

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
 * `all` — все записи, включая только что сохранённую.
 */
export function pickDayReply(
  entry: DayEntry,
  all: DayEntry[],
  tagInfo: (id: string) => TagInfo | null,
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

  // Тяжёлый день: только поддержка, и только если за ней стоит факт из
  // его же дневника. Цитаты и «самые светлые дни» тут неуместны.
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
      return { id: "low_then_better", text: `Похожий день был ${formatDayMonth(low.date)}. ${when} стало лучше.` };
    }
    return { id: "low_written", text: "Записать тяжёлый день — тоже забота о себе." };
  }

  // Цитат «месяц назад» и «год назад» здесь нет намеренно: они уже есть во
  // вкладке «Воспоминания», а у тех, кто пишет регулярно, выпадали бы почти
  // каждый вечер и заслоняли реплики, которых больше нигде нет.

  const dow = parseDay(today).getDay();
  const forms = WEEKDAY_FORMS[dow];
  const tagsOf = (e: DayEntry | undefined) => (e ? [...e.places, ...e.activities] : []);
  const weekAgo = tagsOf(byDate.get(addDays(today, -7)));
  const twoWeeksAgo = tagsOf(byDate.get(addDays(today, -14)));
  let secondWeekTag: TagInfo | null = null;
  for (const id of new Set(tagsOf(entry))) {
    if (!weekAgo.includes(id)) continue;
    const info = tagInfo(id);
    if (!info) continue;
    if (twoWeeksAgo.includes(id)) {
      return { id: "third_weekday_tag", text: `${forms.third} ${forms.noun} подряд ты отмечаешь «${info.label}».` };
    }
    secondWeekTag ??= info;
  }

  const lastMonth = earlier.filter((d) => daysBetween(d, today) <= 30).map((d) => byDate.get(d)!);
  if (entry.mood >= 4 && lastMonth.length >= 5 && lastMonth.every((e) => e.mood < entry.mood)) {
    return { id: "brightest_month", text: "Самый светлый день за последний месяц." };
  }

  if (secondWeekTag) {
    return { id: "second_weekday_tag", text: `${forms.second} ${forms.noun} подряд ты отмечаешь «${secondWeekTag.label}».` };
  }

  // Круглые серии уже отмечает плашка достижения, дублировать её не нужно.
  if (streak >= 4 && !(STREAK_MILESTONES as readonly number[]).includes(streak)) {
    return { id: "streak", text: `${streak}-й день подряд.` };
  }

  if (ENTRY_COUNT_MILESTONES.includes(count)) {
    return { id: "entry_count", text: `Это ${count}-я запись в дневнике.` };
  }

  // Запасной вариант: связать сегодняшнюю запись с итогами недели.
  const weekStart = weekStartOf(today);
  const weekCount = dates.filter((d) => d >= weekStart && d <= today).length;
  if (dow === 0) {
    return weekCount >= WEEKLY_MIN_ENTRIES
      ? { id: "weekly_ready", text: "Итоги недели готовы, они на главном экране." }
      : null;
  }
  if (weekCount >= WEEKLY_MIN_ENTRIES) {
    return { id: "weekly_soon", text: "В воскресенье соберём итоги твоей недели." };
  }
  const needed = WEEKLY_MIN_ENTRIES - weekCount;
  const daysLeftInWeek = 6 - ((dow + 6) % 7);
  if (needed > daysLeftInWeek) return null;
  return {
    id: "weekly_progress",
    text: `Ещё ${needed} ${plural(needed, ["запись", "записи", "записей"])} на этой неделе, и в воскресенье будут итоги.`,
  };
}
