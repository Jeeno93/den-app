import AsyncStorage from "@react-native-async-storage/async-storage";
import * as amplitude from "@amplitude/analytics-react-native";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import { getDayQuestion } from "@/src/data/questions";
import {
  scheduleMemoryNotification,
  cancelMemoryNotification,
} from "@/src/utils/notifications";

const NOTIF_TIME_KEY = "notification_time";
const NOTIF_ID_KEY = "notification_id";
const NOTIF_SCHEDULED_DATE_KEY = "notification_scheduled_date";
const NOTIF_ENABLED_KEY = "notifications_enabled";
const MEMORY_NOTIF_ENABLED_KEY = "memory_notif_enabled";
const MEMORY_NOTIF_SCHEDULED_KEY = "memory_notif_scheduled_date";

interface NotificationContextValue {
  notifHour: number;
  notifMinute: number;
  notificationsEnabled: boolean;
  memoryNotifEnabled: boolean;
  setNotificationTime: (hour: number, minute: number) => Promise<void>;
  setNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setMemoryNotifEnabled: (enabled: boolean) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifHour: 21,
  notifMinute: 0,
  notificationsEnabled: true,
  memoryNotifEnabled: false,
  setNotificationTime: async () => {},
  setNotificationsEnabled: async () => {},
  setMemoryNotifEnabled: async () => {},
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function todayDateString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function scheduleNextDayNotification(hour: number, minute: number): Promise<void> {
  if (Platform.OS === "web") return;

  const lastScheduled = await AsyncStorage.getItem(NOTIF_SCHEDULED_DATE_KEY);
  const today = todayDateString();
  if (lastScheduled === today) return;

  const oldId = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (oldId) {
    try { await Notifications.cancelScheduledNotificationAsync(oldId); } catch {}
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextQuestion = getDayQuestion(tomorrow);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Den",
      body: `Вопрос дня: ${nextQuestion}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
  await AsyncStorage.setItem(NOTIF_SCHEDULED_DATE_KEY, today);
}

async function cancelDailyNotification(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
    if (id) {
      try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
    }
    await AsyncStorage.removeItem(NOTIF_ID_KEY);
    await AsyncStorage.removeItem(NOTIF_SCHEDULED_DATE_KEY);
  } catch {}
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifHour, setNotifHour] = useState(21);
  const [notifMinute, setNotifMinute] = useState(0);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [memoryNotifEnabled, setMemoryNotifEnabledState] = useState(false);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Notifications.requestPermissionsAsync().then(({ status }) => {
        if (status !== "granted") return;
        Promise.all([
          AsyncStorage.getItem(NOTIF_TIME_KEY),
          AsyncStorage.getItem(NOTIF_ENABLED_KEY),
          AsyncStorage.getItem(MEMORY_NOTIF_ENABLED_KEY),
          AsyncStorage.getItem(MEMORY_NOTIF_SCHEDULED_KEY),
        ]).then(([timeVal, enabledVal, memEnabledVal, memScheduled]) => {
          const enabled = enabledVal !== "false";
          setNotificationsEnabledState(enabled);

          const memEnabled = memEnabledVal === "true";
          setMemoryNotifEnabledState(memEnabled);

          if (timeVal) {
            const [h, m] = timeVal.split(":").map(Number);
            setNotifHour(h);
            setNotifMinute(m);
            if (enabled) scheduleNextDayNotification(h, m);
          } else {
            if (enabled) scheduleNextDayNotification(21, 0);
          }

          if (memEnabled) {
            const today = todayDateString();
            if (memScheduled !== today) {
              scheduleMemoryNotification().then(() => {
                AsyncStorage.setItem(MEMORY_NOTIF_SCHEDULED_KEY, today);
              });
            }
          }
        });
      });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Cold-start taps are covered separately by app_opened's source detection
      // in _layout.tsx (getLastNotificationResponseAsync) — this listener only
      // fires for taps while the app is already running/backgrounded.
      const notificationType = typeof data?.type === "string" ? data.type : "daily_reminder";
      amplitude.track("notification_tapped", { type: notificationType });
      if (data?.type === "memory" && typeof data?.date === "string") {
        setTimeout(() => {
          router.push({ pathname: "/day-detail", params: { date: data.date as string } } as any);
        }, 300);
      } else if (data?.type === "letter") {
        setTimeout(() => {
          router.push("/letters" as any);
        }, 300);
      }
    });
    return () => sub.remove();
  }, []);

  const setNotificationTime = async (hour: number, minute: number) => {
    setNotifHour(hour);
    setNotifMinute(minute);
    await AsyncStorage.setItem(NOTIF_TIME_KEY, `${hour}:${minute}`);
    await AsyncStorage.removeItem(NOTIF_SCHEDULED_DATE_KEY);
    if (notificationsEnabled) {
      await scheduleNextDayNotification(hour, minute);
    }
  };

  const setNotificationsEnabled = async (enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    await AsyncStorage.setItem(NOTIF_ENABLED_KEY, enabled ? "true" : "false");
    if (enabled) {
      await AsyncStorage.removeItem(NOTIF_SCHEDULED_DATE_KEY);
      await scheduleNextDayNotification(notifHour, notifMinute);
    } else {
      await cancelDailyNotification();
    }
  };

  const setMemoryNotifEnabled = async (enabled: boolean) => {
    setMemoryNotifEnabledState(enabled);
    await AsyncStorage.setItem(MEMORY_NOTIF_ENABLED_KEY, enabled ? "true" : "false");
    if (enabled) {
      await scheduleMemoryNotification();
      await AsyncStorage.setItem(MEMORY_NOTIF_SCHEDULED_KEY, todayDateString());
    } else {
      await cancelMemoryNotification();
      await AsyncStorage.removeItem(MEMORY_NOTIF_SCHEDULED_KEY);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifHour,
        notifMinute,
        notificationsEnabled,
        memoryNotifEnabled,
        setNotificationTime,
        setNotificationsEnabled,
        setMemoryNotifEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
