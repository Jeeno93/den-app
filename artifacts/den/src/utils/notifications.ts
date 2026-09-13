import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { formatDate, getAllDays, getDay } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";

export const MEMORY_NOTIF_ID_KEY = "memory_notif_id";
export const MEMORY_NOTIF_SCHEDULED_KEY = "memory_notif_scheduled_date";

const GOOD_MOODS = [3, 4, 5];

function extractQuote(entry: DayEntry): string | null {
  const candidates = [
    entry.answers?.learned ?? "",
    entry.proud ?? "",
    entry.answers?.positive?.answer ?? "",
    entry.answers?.dayQuestion ?? "",
    entry.notes ?? "",
    entry.answers?.met ?? "",
  ]
    .map((s) => s.trim())
    .filter((s) => s.length >= 8);

  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function daysBetween(dateStr: string): number {
  const today = new Date();
  const then = new Date(dateStr + "T12:00:00");
  return Math.round((today.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

function daysWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

const REMINDERS_KEY = "daily_reminders";
// Старый формат: одно ежедневное повторяющееся уведомление с вопросом дня.
// Его id надо снять при первом перепланировании, иначе у обновившихся
// пользователей старое уведомление продолжит приходить рядом с новыми.
const LEGACY_REMINDER_ID_KEY = "notification_id";
const LEGACY_REMINDER_DATE_KEY = "notification_scheduled_date";

type Invite = { id: string; body: string };

/**
 * Приглашения вместо вопроса дня. Вопрос в шторке требует ответа сразу, и в
 * дни, когда он неудачный, раздражает само уведомление. Приглашение ничего не
 * требует. Метка варианта уходит в данные уведомления, чтобы по тапам было
 * видно, какой текст возвращает лучше.
 */
const DAILY_INVITES: Invite[] = [
  { id: "how_was_day", body: "Как прошёл твой день? Две минуты, и он записан." },
  { id: "speak_out", body: "Выговорись. Запиши, что было сегодня." },
  { id: "main_thing", body: "Что сегодня было главным? Запиши, пока помнишь." },
  { id: "hard_day", body: "Если день был тяжёлым, его тоже стоит записать." },
  { id: "few_lines", body: "Пара строк о сегодняшнем дне, и можно отдыхать." },
  { id: "today_counts", body: "Сегодня тоже считается. Отметь его." },
];

/** Для тех, кто давно не открывал приложение: без упрёка и без вопроса. */
const COMEBACK_INVITES: Invite[] = [
  { id: "comeback_how_are_you", body: "Давно не виделись. Как ты?" },
  { id: "comeback_here", body: "Den на месте, когда захочется записать день." },
];

// Дни от последнего открытия: каждый вечер первую неделю, затем по одному на
// 10-й и 14-й день, дальше тишина. Раньше одно уведомление повторялось
// бесконечно с одним и тем же текстом, и как раз у тех, кого оно должно было
// вернуть, превращалось в спам.
const DAILY_OFFSETS = [0, 1, 2, 3, 4, 5, 6, 7];
const COMEBACK_OFFSETS = [10, 14];

type ScheduledReminder = { id: string; date: string };

function dayOfYear(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86400000);
}

async function readScheduledReminders(): Promise<ScheduledReminder[]> {
  try {
    const raw = await AsyncStorage.getItem(REMINDERS_KEY);
    return raw ? (JSON.parse(raw) as ScheduledReminder[]) : [];
  } catch {
    return [];
  }
}

// Перепланирование запускается из нескольких мест: при старте, при
// возвращении в приложение, при смене времени. Без очереди два запуска
// прочитают один и тот же список, и оба поставят свой набор уведомлений.
let reminderQueue: Promise<void> = Promise.resolve();
function enqueue(task: () => Promise<void>): Promise<void> {
  reminderQueue = reminderQueue.then(task, task);
  return reminderQueue;
}

async function cancelAllReminders(): Promise<void> {
  const ids = (await readScheduledReminders()).map((r) => r.id);
  const legacyId = await AsyncStorage.getItem(LEGACY_REMINDER_ID_KEY);
  if (legacyId) ids.push(legacyId);
  for (const id of ids) {
    try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
  }
  await AsyncStorage.multiRemove([REMINDERS_KEY, LEGACY_REMINDER_ID_KEY, LEGACY_REMINDER_DATE_KEY]);
}

/** Ставит напоминания заново, отсчитывая дни от текущего момента. */
export function scheduleDailyReminders(hour: number, minute: number): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  return enqueue(async () => {
    try {
      await cancelAllReminders();
      const now = new Date();
      // Если сегодняшний день уже записан, вечером напоминать не о чем.
      const writtenToday = Boolean(await getDay(formatDate(now)));
      const plan = [
        ...DAILY_OFFSETS.map((offset) => ({ offset, pool: DAILY_INVITES })),
        ...COMEBACK_OFFSETS.map((offset, i) => ({ offset, pool: [COMEBACK_INVITES[i % COMEBACK_INVITES.length]] })),
      ];
      const scheduled: ScheduledReminder[] = [];
      for (const { offset, pool } of plan) {
        if (offset === 0 && writtenToday) continue;
        const fireDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute, 0, 0);
        if (fireDate <= now) continue;
        // Вариант привязан к дате, а не к порядку: перепланирование в тот же
        // день не меняет текст, а соседние дни получают разные тексты.
        const invite = pool[dayOfYear(fireDate) % pool.length];
        const id = await Notifications.scheduleNotificationAsync({
          content: {
            title: "Den",
            body: invite.body,
            data: { type: "daily_reminder", variant: invite.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireDate,
          },
        });
        scheduled.push({ id, date: formatDate(fireDate) });
      }
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(scheduled));
    } catch (err) {
      console.warn("[notifications] scheduleDailyReminders failed:", err);
    }
  });
}

export function cancelDailyReminders(): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  return enqueue(async () => {
    try { await cancelAllReminders(); } catch {}
  });
}

/** Сегодняшний день записан: вечернее напоминание уже ни к чему. */
export function cancelTodayReminder(): Promise<void> {
  if (Platform.OS === "web") return Promise.resolve();
  return enqueue(async () => {
    try {
      const today = formatDate(new Date());
      const keep: ScheduledReminder[] = [];
      for (const r of await readScheduledReminders()) {
        if (r.date === today) {
          try { await Notifications.cancelScheduledNotificationAsync(r.id); } catch {}
        } else {
          keep.push(r);
        }
      }
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(keep));
    } catch {}
  });
}

export async function scheduleMemoryNotification(): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const oldId = await AsyncStorage.getItem(MEMORY_NOTIF_ID_KEY);
    if (oldId) {
      try { await Notifications.cancelScheduledNotificationAsync(oldId); } catch {}
      await AsyncStorage.removeItem(MEMORY_NOTIF_ID_KEY);
    }

    const allEntries = await getAllDays();
    const goodEntries = allEntries.filter(
      (e) => GOOD_MOODS.includes(e.mood) && daysBetween(e.date) >= 3
    );
    if (goodEntries.length === 0) return null;

    const entry = goodEntries[Math.floor(Math.random() * goodEntries.length)];
    const quote = extractQuote(entry);
    if (!quote) return null;

    const days = daysBetween(entry.date);
    const preview = quote.length > 100 ? quote.slice(0, 97) + "…" : quote;
    const body = `${days} ${daysWord(days)} назад ты написал: «${preview}»`;

    const fireDate = new Date();
    fireDate.setDate(fireDate.getDate() + 3);
    fireDate.setHours(11 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Воспоминание 💭",
        body,
        data: { type: "memory", date: entry.date },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });

    await AsyncStorage.setItem(MEMORY_NOTIF_ID_KEY, id);
    return id;
  } catch (err) {
    console.warn("[notifications] scheduleMemoryNotification failed:", err);
    return null;
  }
}

export async function cancelMemoryNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const id = await AsyncStorage.getItem(MEMORY_NOTIF_ID_KEY);
    if (id) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
      await AsyncStorage.removeItem(MEMORY_NOTIF_ID_KEY);
    }
  } catch {}
}

export async function scheduleLetterNotification(
  letterId: string,
  openDate: string
): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const fireDate = new Date(openDate + "T10:00:00");
    if (fireDate <= new Date()) return null;

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Письмо себе ✉️",
        body: "Твоё письмо себе готово к прочтению",
        data: { type: "letter", letterId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
      },
    });
    return id;
  } catch (err) {
    console.warn("[notifications] scheduleLetterNotification failed:", err);
    return null;
  }
}

export async function cancelLetterNotification(notifId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notifId);
  } catch {}
}
