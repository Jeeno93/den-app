import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_FULL = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function getCalendarMoodColor(mood: number): string {
  if (mood <= 2) return "#FF6767";
  if (mood === 3) return "#C7CDD4";
  return "#5EE6A8";
}

function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirst = new Date(year, month, 1).getDay();
  const leadingPad = (rawFirst + 6) % 7;
  const cells: (string | null)[] = Array(leadingPad).fill(null);
  for (let i = 0; i < daysInMonth; i++) {
    const d = new Date(year, month, i + 1);
    cells.push(formatDate(d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export default function YearPixelsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const todayString = formatDate(now);

  const [year, setYear] = useState(currentYear);
  const [entryMap, setEntryMap] = useState<Map<string, DayEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  useEffect(() => {
    getAllDays().then((entries) => {
      const map = new Map<string, DayEntry>();
      entries.forEach((e) => map.set(e.date, e));
      setEntryMap(map);
      setLoading(false);
    });
  }, []);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
    toastTimer.current = setTimeout(() => setToast(null), 2100);
  }

  const H_PAD = 16;
  const CELL_GAP = 3;
  const cellSize = Math.floor((screenWidth - H_PAD * 2 - CELL_GAP * 6) / 7);

  const maxMonth = year === currentYear ? currentMonth : 11;
  const months = useMemo(() => {
    return Array.from({ length: maxMonth + 1 }, (_, m) => ({
      month: m,
      rows: buildMonthGrid(year, m),
    }));
  }, [year, maxMonth]);

  return (
    <View style={{ flex: 1, backgroundColor: "#06080B" }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: "#06080B", borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Год в пикселях</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={[styles.yearNav, { borderBottomColor: theme.border, backgroundColor: "#06080B" }]}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => setYear((y) => y - 1)}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.yearText, { color: theme.foreground }]}>{year}</Text>
        <TouchableOpacity
          style={[styles.iconBtn, year >= currentYear && { opacity: 0.3 }]}
          onPress={() => setYear((y) => Math.min(y + 1, currentYear))}
          disabled={year >= currentYear}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-forward" size={22} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#06080B" }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>Загрузка…</Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1, backgroundColor: "#06080B" }}
          contentContainerStyle={{ paddingHorizontal: H_PAD, paddingBottom: bottomPad + 60 }}
          showsVerticalScrollIndicator={false}
        >
          {months.map(({ month, rows }) => (
            <View key={month} style={{ marginTop: 28 }}>
              <View style={styles.monthHeader}>
                <Text style={[styles.monthName, { color: theme.foreground }]}>
                  {MONTHS_FULL[month]}
                </Text>
                <View style={[styles.monthDivider, { backgroundColor: theme.border }]} />
              </View>

              <View style={[styles.dowRow, { gap: CELL_GAP }]}>
                {DOW_LABELS.map((d) => (
                  <View key={d} style={{ width: cellSize, alignItems: "center" }}>
                    <Text style={{ color: theme.mutedForeground, fontSize: 11, fontWeight: "600" }}>
                      {d}
                    </Text>
                  </View>
                ))}
              </View>

              {rows.map((row, ri) => (
                <View key={ri} style={[styles.weekRow, { gap: CELL_GAP, marginTop: CELL_GAP }]}>
                  {row.map((date, di) => {
                    if (!date) {
                      return (
                        <View key={di} style={{ width: cellSize, height: cellSize }} />
                      );
                    }
                    const entry = entryMap.get(date);
                    const isToday = date === todayString;
                    const bgColor = entry
                      ? getCalendarMoodColor(entry.mood)
                      : "#1A2030";

                    return (
                      <TouchableOpacity
                        key={di}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: bgColor,
                          borderRadius: 6,
                          borderWidth: isToday ? 2 : 0,
                          borderColor: isToday ? "#5EE6A8" : "transparent",
                        }}
                        onPress={() => {
                          if (entry) {
                            router.push({ pathname: "/day-detail", params: { date } });
                          } else {
                            showToast("В этот день нет записи");
                          }
                        }}
                        activeOpacity={0.75}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      {toast !== null && (
        <Animated.View
          style={[
            styles.toast,
            { bottom: bottomPad + 24 },
            { opacity: toastOpacity },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  title: { fontSize: 17, fontWeight: "600" },
  yearNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  yearText: { fontSize: 17, fontWeight: "700" },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  monthName: {
    fontSize: 15,
    fontWeight: "700",
    minWidth: 100,
  },
  monthDivider: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dowRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekRow: {
    flexDirection: "row",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "#333",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});
