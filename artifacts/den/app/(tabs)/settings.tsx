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
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { useTheme } from "@/src/context/ThemeContext";
import { useNotifications } from "@/src/context/NotificationContext";
import colors from "@/constants/colors";
import { getAllDays, saveDay, getDiagnostics } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";

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
        <Text style={[styles.timeNum, { color: theme.foreground }]}>{String(h).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={decH} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.timeSep, { color: theme.foreground }]}>:</Text>
      <View style={styles.timeUnit}>
        <TouchableOpacity onPress={incM} style={styles.timeBtn}>
          <Ionicons name="chevron-up" size={20} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.timeNum, { color: theme.foreground }]}>{String(m).padStart(2, "0")}</Text>
        <TouchableOpacity onPress={decM} style={styles.timeBtn}>
          <Ionicons name="chevron-down" size={20} color={theme.primary} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={() => onConfirm(h, m)}>
        <Text style={[styles.confirmBtnText, { color: theme.primaryForeground }]}>Сохранить</Text>
      </TouchableOpacity>
    </View>
  );
}

interface DiagResult {
  totalKeys: number;
  dayKeys: string[];
  lastEntryKey: string | null;
  lastEntryRaw: string | null;
}

export default function SettingsScreen() {
  const { isDark, themeMode, setThemeMode } = useTheme();
  const { notifHour, notifMinute, notificationsEnabled, setNotificationTime, setNotificationsEnabled } = useNotifications();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [diagResult, setDiagResult] = useState<DiagResult | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleTimeConfirm(h: number, m: number) {
    await setNotificationTime(h, m);
    setShowTimePicker(false);
    if (Platform.OS !== "web") {
      Alert.alert("Готово", `Уведомление установлено на ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  async function handleExport() {
    try {
      const entries = await getAllDays();
      if (entries.length === 0) {
        Alert.alert("Нет данных", "В дневнике ещё нет ни одной записи.");
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const fileName = `den_backup_${today}.json`;
      const payload = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2);

      Alert.alert(
        "Экспортировать данные",
        `Будет экспортировано ${entries.length} ${recordWord(entries.length)}.`,
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "Экспортировать",
            onPress: async () => {
              try {
                if (Platform.OS === "web") {
                  Alert.alert("Недоступно", "Экспорт доступен только на мобильных устройствах.");
                  return;
                }
                const filePath = (FileSystem.cacheDirectory ?? "") + fileName;
                await FileSystem.writeAsStringAsync(filePath, payload, { encoding: FileSystem.EncodingType.UTF8 });
                const available = await Sharing.isAvailableAsync();
                if (available) {
                  await Sharing.shareAsync(filePath, { mimeType: "application/json", dialogTitle: "Сохранить резервную копию", UTI: "public.json" });
                } else {
                  Alert.alert("Ошибка", "Функция поделиться недоступна на этом устройстве.");
                }
              } catch (err) {
                console.error("[export]", err);
                Alert.alert("Ошибка", "Не удалось создать файл резервной копии.");
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error("[export]", err);
      Alert.alert("Ошибка", "Не удалось получить данные из хранилища.");
    }
  }

  async function handleImport() {
    try {
      if (Platform.OS === "web") {
        Alert.alert("Недоступно", "Импорт доступен только на мобильных устройствах.");
        return;
      }
      const result = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const raw = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        Alert.alert("Ошибка файла", "Файл повреждён или не является JSON.");
        return;
      }

      // Validate format
      const entries: DayEntry[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.entries)
        ? parsed.entries
        : null;

      if (!entries) {
        Alert.alert("Неверный формат", "Файл не является резервной копией Den.");
        return;
      }

      const valid = entries.filter(
        (e) => e && typeof e.date === "string" && typeof e.mood === "number" && e.answers
      );

      if (valid.length === 0) {
        Alert.alert("Нет записей", "В файле не найдено ни одной валидной записи Den.");
        return;
      }

      Alert.alert(
        "Восстановить данные",
        `Найдено ${valid.length} ${recordWord(valid.length)}. Восстановить?\n\nСуществующие записи за те же даты будут перезаписаны.`,
        [
          { text: "Отмена", style: "cancel" },
          {
            text: "Восстановить",
            onPress: async () => {
              try {
                for (const entry of valid) {
                  await saveDay(entry.date, entry);
                }
                Alert.alert("Готово", `Восстановлено ${valid.length} ${recordWord(valid.length)}.`);
              } catch (err) {
                console.error("[import]", err);
                Alert.alert("Ошибка", "Не удалось сохранить часть записей.");
              }
            },
          },
        ]
      );
    } catch (err) {
      console.error("[import]", err);
      Alert.alert("Ошибка", "Не удалось открыть файл.");
    }
  }

  function recordWord(n: number): string {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 14) return "записей";
    if (mod10 === 1) return "запись";
    if (mod10 >= 2 && mod10 <= 4) return "записи";
    return "записей";
  }

  async function handleDiagnose() {
    setDiagLoading(true);
    try {
      const result = await getDiagnostics();
      setDiagResult(result);
    } catch {
      Alert.alert("Ошибка", "Не удалось запустить диагностику.");
    } finally {
      setDiagLoading(false);
    }
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
          {/* Toggle row */}
          <View style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <View style={[styles.rowIcon, { backgroundColor: theme.primary + "20" }]}>
              <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            </View>
            <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>Напоминания</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: theme.border, true: theme.primary + "88" }}
              thumbColor={notificationsEnabled ? theme.primary : theme.mutedForeground}
            />
          </View>

          {/* Time picker row — hidden when disabled */}
          {notificationsEnabled && (
            <TouchableOpacity
              style={styles.row}
              onPress={() => setShowTimePicker((v) => !v)}
              activeOpacity={0.7}
              testID="notif-time-row"
            >
              <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
                <Ionicons name="time-outline" size={20} color={theme.mutedForeground} />
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
          )}

          {notificationsEnabled && showTimePicker && (
            <View style={[styles.pickerWrapper, { borderTopColor: theme.border }]}>
              <TimeSelector hour={notifHour} minute={notifMinute} onConfirm={handleTimeConfirm} />
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
                style={[styles.row, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.border }]}
                onPress={() => setThemeMode(mode)}
                activeOpacity={0.7}
                testID={`theme-${mode}`}
              >
                <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
                  <Ionicons name={icons[mode]} size={20} color={theme.foreground} />
                </View>
                <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>{labels[mode]}</Text>
                {themeMode === mode && <Ionicons name="checkmark-circle" size={22} color={theme.primary} />}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>О приложении</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.row} onPress={() => router.push("/why-diary" as any)} activeOpacity={0.7}>
            <View style={[styles.rowIcon, { backgroundColor: "#1a5c4220" }]}>
              <Text style={{ fontSize: 18 }}>🧠</Text>
            </View>
            <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>Зачем вести дневник</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Данные</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.row, { borderBottomWidth: 1, borderBottomColor: theme.border }]}
            onPress={handleExport}
            activeOpacity={0.7}
            testID="export-button"
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
              <Ionicons name="archive-outline" size={20} color={theme.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.foreground }]}>Экспортировать данные</Text>
              <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>Сохранить копию в файл JSON</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.row}
            onPress={handleImport}
            activeOpacity={0.7}
            testID="import-button"
          >
            <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
              <Ionicons name="cloud-download-outline" size={20} color={theme.foreground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: theme.foreground }]}>Восстановить данные</Text>
              <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>Импорт из файла резервной копии</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Диагностика</Text>
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.row} onPress={handleDiagnose} activeOpacity={0.7} testID="diagnostics-button">
            <View style={[styles.rowIcon, { backgroundColor: theme.muted }]}>
              <Ionicons name="bug-outline" size={20} color={theme.foreground} />
            </View>
            <Text style={[styles.rowTitle, { color: theme.foreground, flex: 1 }]}>
              {diagLoading ? "Проверка…" : "Проверить хранилище"}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>

          {diagResult !== null && (
            <View style={[styles.diagBox, { borderTopColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}>
              <Text style={[styles.diagLine, styles.diagBold, { color: theme.foreground }]}>
                Всего ключей в хранилище: {diagResult.totalKeys}
              </Text>
              <Text style={[styles.diagLine, styles.diagBold, { color: theme.foreground }]}>
                Записей дневника: {diagResult.dayKeys.length}
              </Text>

              {diagResult.dayKeys.length === 0 ? (
                <Text style={[styles.diagLine, { color: "#FF453A" }]}>
                  ⚠️ Ключи day_* не найдены — данные не сохранились
                </Text>
              ) : (
                <>
                  <Text style={[styles.diagLine, styles.diagLabel, { color: theme.mutedForeground }]}>Ключи:</Text>
                  {diagResult.dayKeys.slice(0, 10).map((k) => (
                    <Text key={k} style={[styles.diagLine, styles.diagMono, { color: theme.foreground }]}>• {k}</Text>
                  ))}
                  {diagResult.dayKeys.length > 10 && (
                    <Text style={[styles.diagLine, { color: theme.mutedForeground }]}>… и ещё {diagResult.dayKeys.length - 10}</Text>
                  )}
                </>
              )}

              {diagResult.lastEntryKey && (
                <>
                  <Text style={[styles.diagLine, styles.diagLabel, { color: theme.mutedForeground, marginTop: 8 }]}>
                    Последняя запись ({diagResult.lastEntryKey}):
                  </Text>
                  <Text style={[styles.diagLine, styles.diagMono, { color: theme.foreground }]} numberOfLines={6}>
                    {diagResult.lastEntryRaw
                      ? JSON.stringify(JSON.parse(diagResult.lastEntryRaw), null, 2).slice(0, 400)
                      : "null"}
                  </Text>
                </>
              )}

              <TouchableOpacity onPress={() => setDiagResult(null)} style={{ marginTop: 8, alignSelf: "flex-end" }}>
                <Text style={[styles.diagLine, { color: theme.primary, fontWeight: "600" }]}>Закрыть</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <Text style={[styles.appVersion, { color: theme.mutedForeground }]}>Den · v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  container: { paddingHorizontal: 20, gap: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
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
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSub: { fontSize: 13, marginTop: 1 },
  pickerWrapper: { borderTopWidth: 1, padding: 16 },
  timeSelector: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  timeUnit: { alignItems: "center", gap: 8 },
  timeBtn: { padding: 6 },
  timeNum: {
    fontSize: 32,
    fontWeight: "700",
    width: 60,
    textAlign: "center",
    letterSpacing: -1,
  },
  timeSep: { fontSize: 32, fontWeight: "700", paddingBottom: 4 },
  confirmBtn: { marginLeft: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  confirmBtnText: { fontSize: 14, fontWeight: "600" },
  appVersion: { textAlign: "center", fontSize: 13, marginTop: 24 },
  diagBox: { borderTopWidth: 1, padding: 14, gap: 4 },
  diagLine: { fontSize: 13, lineHeight: 20 },
  diagBold: { fontWeight: "700" },
  diagLabel: {
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontSize: 11,
    marginTop: 6,
  },
  diagMono: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    fontSize: 12,
  },
});
