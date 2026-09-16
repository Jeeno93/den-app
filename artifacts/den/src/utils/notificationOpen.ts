import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NotificationResponse } from "expo-notifications";

const LAST_COUNTED_KEY = "last_counted_notification_response";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Система отдаёт последний тап по уведомлению при каждом запуске приложения,
 * даже если человек давно открывает его сам. Из-за этого открытий «по
 * уведомлению» у версии 1.1.0 за 15 сентября было 28 при 4 реальных тапах.
 * Каждый тап засчитывается один раз: запоминаем его по номеру уведомления и
 * времени доставки (у повторяющихся уведомлений номер одинаковый).
 */
function responseKey(response: NotificationResponse): string {
  return `${response.notification.request.identifier}:${response.notification.date}`;
}

/** Тап по уведомлению, доставленному больше суток назад, запуском по уведомлению не считаем. */
export function isRecentNotificationResponse(response: NotificationResponse): boolean {
  const raw = response.notification.date;
  const deliveredAt = raw < 1e12 ? raw * 1000 : raw;
  return Date.now() - deliveredAt <= MAX_AGE_MS;
}

// Запуск по уведомлению проверяют два места: app_opened при старте и слушатель
// тапов. Общий промис на тап гарантирует, что оба получат одинаковый ответ, в
// каком бы порядке ни сработали.
const claims = new Map<string, Promise<boolean>>();

/** true — этот тап ещё ни разу не засчитывался. Повторный вызов с тем же тапом вернёт тот же ответ. */
export function claimNotificationResponse(response: NotificationResponse): Promise<boolean> {
  const key = responseKey(response);
  const existing = claims.get(key);
  if (existing) return existing;
  const claim = (async () => {
    const lastCounted = await AsyncStorage.getItem(LAST_COUNTED_KEY).catch(() => null);
    if (lastCounted === key) return false;
    await AsyncStorage.setItem(LAST_COUNTED_KEY, key).catch(() => {});
    return true;
  })();
  claims.set(key, claim);
  return claim;
}
