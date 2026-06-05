import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { getAllDays } from "@/src/storage/storage";
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
