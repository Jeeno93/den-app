import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { getDayQuestion } from "@/src/data/questions";

const NOTIF_TIME_KEY = "notification_time";
const NOTIF_ID_KEY = "notification_id";

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

async function scheduleDaily(hour: number, minute: number) {
  if (Platform.OS === "web") return;
  const todayQ = getDayQuestion(new Date());
  const oldId = await AsyncStorage.getItem(NOTIF_ID_KEY);
  if (oldId) {
    await Notifications.cancelScheduledNotificationAsync(oldId);
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "День",
      body: `Сегодняшний вопрос: ${todayQ}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
  await AsyncStorage.setItem(NOTIF_ID_KEY, id);
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
            scheduleDaily(h, m);
          } else {
            scheduleDaily(21, 0);
          }
        });
      });
    }
  }, []);

  const setNotificationTime = async (hour: number, minute: number) => {
    setNotifHour(hour);
    setNotifMinute(minute);
    await AsyncStorage.setItem(NOTIF_TIME_KEY, `${hour}:${minute}`);
    await scheduleDaily(hour, minute);
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
