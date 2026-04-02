import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { getDayQuestion } from "@/src/data/questions";

const NOTIF_TIME_KEY = "notification_time";
const NOTIF_ID_KEY = "notification_id";
const NOTIF_SCHEDULED_DATE_KEY = "notification_scheduled_date";

interface NotificationContextValue {
  notifHour: number;
  notifMinute: number;
  setNotificationTime: (hour: number, minute: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifHour: 21,
  notifMinute: 0,
  setNotificationTime: async () => {},
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

  if (lastScheduled === today) {
    return;
  }

  const oldId = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (oldId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(oldId);
    } catch {
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextQuestion = getDayQuestion(tomorrow);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "День",
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

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifHour, setNotifHour] = useState(21);
  const [notifMinute, setNotifMinute] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "web") {
      Notifications.requestPermissionsAsync().then(({ status }) => {
        if (status !== "granted") return;
        AsyncStorage.getItem(NOTIF_TIME_KEY).then((val) => {
          if (val) {
            const [h, m] = val.split(":").map(Number);
            setNotifHour(h);
            setNotifMinute(m);
            scheduleNextDayNotification(h, m);
          } else {
            scheduleNextDayNotification(21, 0);
          }
        });
      });
    }
  }, []);

  const setNotificationTime = async (hour: number, minute: number) => {
    setNotifHour(hour);
    setNotifMinute(minute);
    await AsyncStorage.setItem(NOTIF_TIME_KEY, `${hour}:${minute}`);
    await AsyncStorage.removeItem(NOTIF_SCHEDULED_DATE_KEY);
    await scheduleNextDayNotification(hour, minute);
  };

  return (
    <NotificationContext.Provider value={{ notifHour, notifMinute, setNotificationTime }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
