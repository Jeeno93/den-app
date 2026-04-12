import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import { useNotifications } from "@/src/context/NotificationContext";
import colors from "@/constants/colors";

function TimeSelector({ hour, minute, onConfirm }: { hour: number; minute: number; onConfirm: (h: number, m: number) => void }) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  const [h, setH] = useState(hour);
  const [m, setM] = useState(minute);

  const incH = () => setH((x) => (x + 1) % 24);
  const decH = () => setH((x) => (x - 1 + 24) % 24);
  const incM = () => setM((x) => (x + 5) % 60);
  const decM = () => setM((x) => (x - 5 + 60) % 60);

  return (
    <View style={[styles.timeSelector, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.timeUnit}>
        <TouchableOpacity onPress={incH} style={styles.timeBtn}>
          <Ionicons name="chevron-up" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.timeNum, { color: theme.foreground }]}>
          {String(h).padStart(2, "0")}
        </Text>
        <TouchableOpacity onPress={decH} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.timeSep, { color: theme.foreground }]}>:</Text>
      <View style={styles.timeUnit}>
        <TouchableOpacity onPress={incM} style={styles.timeBtn}>
          <Ionicons name="chevron-up" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.timeNum, { color: theme.foreground }]}>
          {String(m).padStart(2, "0")}
        </Text>
        <TouchableOpacity onPress={decM} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.confirmBtn, { backgroundColor: theme.primary }]}
        onPress={() => onConfirm(h, m)}
      >
        <Text style={[styles.confirmBtnText, { color: theme.primaryForeground }]}>Сохранить</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function SettingsScreen() {
  const { isDark, themeMode, setThemeMode } = useTheme();
  const { notifHour, notifMinute, setNotificationTime } = useNotifications();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [showTimePicker, setShowTimePicker] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleTimeConfirm(h: number, m: number) {
    await setNotificationTime(h, m);
    setShowTimePicker(false);
    if (Platform.OS !== "web") {
      Alert.alert("Готово", `Уведомление установлено на ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  function handleExport() {
    Alert.alert("Экспорт", "Эта функция появится в следующей версии.");
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.foreground }]}>Настройки</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Уведомления</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => setShowTimePicker((v) => !v)}
            activeOpacity={0.7}
            testID="notif-time-row"
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.primary + "20" }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.foreground }]}>Время напоминания</Text>
              <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
                {String(notifHour).padStart(2, "0")}:{String(notifMinute).padStart(2, "0")}
              </Text>
            </View>
            <Ionicons
              name={showTimePicker ? "chevron-up" : "chevron-down"}
              size={18}
              color={theme.mutedForeground}
            />
          </TouchableOpacity>

          {showTimePicker && (
            <View style={[styles.pickerWrapper, { borderTopColor: theme.border }]}>
              <TimeSelector
                hour={notifHour}
                minute={notifMinute}
                onConfirm={handleTimeConfirm}
              />
            </View>
          )}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Оформление</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {(["system", "light", "dark"] as const).map((mode, idx) => {
            const labels = { system: "Системная", light: "Светлая", dark: "Тёмная" };
            const icons: Record<typeof mode, React.ComponentProps<typeof Ionicons>["name"]> = {
              system: "phone-portrait-outline",
              light: "sunny-outline",
              dark: "moon-outline",
            };
            const isLast = idx === 2;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.row,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border },
                ]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.7}
                testID={`theme-${mode}`}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
                  <Ionicons name={icons[mode]} size={20} color={theme.foreground} />
                </View>
                <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>
                  {labels[mode]}
                </Text>
                {themeMode === mode && (
                  <Ionicons name="checkmark-circle" size={22} color={theme.primary} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>О приложении</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push("/why-diary" as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.rowIcon, { backgroundColor: "#1a5c4220" }]}>
              <Text style={{ fontSize: 18 }}>🧠</Text>
            </View>
            <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>
              Зачем вести дневник
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Данные</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={handleExport}
            activeOpacity={0.7}
            testID="export-button"
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
              <Ionicons name="share-outline" size={20} color={theme.foreground} />
            </View>
            <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>
              Экспорт данных
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.appVersion, { color: theme.mutedForeground }]}>
          Den · v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  container: {
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 13,
    marginTop: 1,
  },
  pickerWrapper: {
    borderTopWidth: 1,
    padding: 16,
  },
  timeSelector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeUnit: {
    alignItems: "center",
    gap: 8,
  },
  timeBtn: {
    padding: 6,
  },
  timeNum: {
    fontSize: 32,
    fontWeight: "700",
    width: 60,
    textAlign: "center",
    letterSpacing: -1,
  },
  timeSep: {
    fontSize: 32,
    fontWeight: "700",
    paddingBottom: 4,
  },
  confirmBtn: {
    marginLeft: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  appVersion: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 24,
  },
});
