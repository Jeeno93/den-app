import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as amplitude from "@amplitude/analytics-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotifications } from "@/src/context/NotificationContext";

const ASK_DONE_KEY = "notif_ask_after_entry_done";
// Вечер, когда человек с наибольшей вероятностью сядет писать. Совпадает с
// умолчанием, которое раньше предлагалось в онбординге.
const DEFAULT_HOUR = 21;
const DEFAULT_MINUTE = 0;

interface ThemeColors {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  primary: string;
}

/**
 * Запрос разрешения на уведомления после первой сохранённой записи.
 *
 * Раньше спрашивали в онбординге — и 55% жали «пропустить», не дойдя даже до
 * системного диалога (те, кто доходил, разрешали в 85% случаев). Причина в
 * моменте: в онбординге человек ещё ничего не записал, и напоминание ему
 * предлагают о деле, ценности которого он пока не понимает. Здесь он только
 * что закрыл свой первый день — и «напомнить завтра вечером» читается как
 * продолжение того, что он сам сделал, а не как просьба приложения.
 *
 * Показывается один раз: дальше решение живёт в настройках.
 */
export function NotificationAskCard({ theme }: { theme: ThemeColors }) {
  const { notificationsEnabled, setNotificationTime, setNotificationsEnabled } = useNotifications();
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // На web локальных запланированных уведомлений нет — спрашивать не о чем.
      if (Platform.OS === "web") return;
      if (notificationsEnabled) return;
      const asked = await AsyncStorage.getItem(ASK_DONE_KEY);
      if (!cancelled && !asked) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [notificationsEnabled]);

  async function markAsked() {
    await AsyncStorage.setItem(ASK_DONE_KEY, "true").catch(() => {});
  }

  async function handleEnable() {
    setBusy(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const granted = status === "granted";
      amplitude.track("notification_permission_requested", {
        granted,
        skipped: false,
        placement: "after_first_entry",
      });
      if (granted) await setNotificationTime(DEFAULT_HOUR, DEFAULT_MINUTE);
      await setNotificationsEnabled(granted);
    } catch {
      amplitude.track("notification_permission_requested", {
        granted: false,
        skipped: false,
        placement: "after_first_entry",
      });
    } finally {
      await markAsked();
      setBusy(false);
      setVisible(false);
    }
  }

  async function handleSkip() {
    amplitude.track("notification_permission_requested", {
      granted: null,
      skipped: true,
      placement: "after_first_entry",
    });
    await markAsked();
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.headerRow}>
        <Ionicons name="notifications-outline" size={18} color={theme.primary} />
        <Text style={[styles.title, { color: theme.foreground }]}>Напомнить завтра вечером?</Text>
      </View>
      <Text style={[styles.sub, { color: theme.mutedForeground }]}>
        Один раз в 21:00. Время можно поменять в настройках.
      </Text>
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleSkip}
          disabled={busy}
          activeOpacity={0.7}
          style={[styles.btn, styles.btnGhost, { borderColor: theme.border }]}
        >
          <Text style={[styles.btnGhostText, { color: theme.mutedForeground }]}>Не надо</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleEnable}
          disabled={busy}
          activeOpacity={0.85}
          style={[styles.btn, { backgroundColor: theme.primary }]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#06080B" />
          ) : (
            <Text style={styles.btnPrimaryText}>Напоминать</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 28,
    marginHorizontal: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    alignSelf: "stretch",
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
  sub: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 10 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  btnGhost: { borderWidth: 1 },
  btnGhostText: { fontSize: 14, fontWeight: "600" },
  btnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#06080B" },
});
