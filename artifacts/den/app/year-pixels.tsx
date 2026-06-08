import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
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
import { getMoodColor, getMoodEmoji, getMoodLabel } from "@/src/components/MoodPicker";

const DOW_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS_SHORT = [
  "янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек",
];

function buildYearGrid(year: number): { cells: (string | null)[], numRows: number } {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const totalDays = Math.round((dec31.getTime() - jan1.getTime()) / 86400000) + 1;

  const rawDow = jan1.getDay();
  const leadingPad = (rawDow + 6) % 7;

  const cells: (string | null)[] = Array(leadingPad).fill(null);
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(year, 0, 1 + i);
    cells.push(formatDate(d));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return { cells, numRows: cells.length / 7 };
}

function toRows(cells: (string | null)[]): (string | null)[][] {
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

function getMonthLabelForRow(row: (string | null)[]): string | null {
  for (const date of row) {
    if (!date) continue;
    const d = new Date(date + "T12:00:00");
    if (d.getDate() === 1) return MONTHS_SHORT[d.getMonth()];
  }
  return null;
}

export default function YearPixelsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const todayString = formatDate(now);

  const [year, setYear] = useState(currentYear);
  const [entryMap, setEntryMap] = useState<Map<string, DayEntry>>(new Map());
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const { cells, numRows: rawNumRows } = useMemo(() => buildYearGrid(year), [year]);
  const allRows = useMemo(() => toRows(cells), [cells]);

  // Task 3: for current year hide rows that are entirely in future months
  const rows = useMemo(() => {
    if (year < currentYear) return allRows;
    const lastDayOfCurrentMonth = new Date(currentYear, currentMonth + 1, 0);
    const lastISO = formatDate(lastDayOfCurrentMonth);
    return allRows.filter((row) => {
      const realDates = row.filter((d): d is string => d !== null);
      if (realDates.length === 0) return false;
      return realDates.some((d) => d <= lastISO);
    });
  }, [allRows, year, currentYear, currentMonth]);

  const numRows = rows.length;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const HEADER_H = topPad + 52;
  const YEAR_NAV_H = 44;
  const DOW_ROW_H = 20;
  const MONTH_LABEL_W = 26;
  const H_PAD = 10;
  const GAP = 2;

  const availableH = screenHeight - HEADER_H - YEAR_NAV_H - DOW_ROW_H - bottomPad - 20;
  const availableW = screenWidth - H_PAD * 2 - MONTH_LABEL_W - GAP * 6;

  const cellByH = Math.floor((availableH - GAP * (numRows - 1)) / numRows);
  const cellByW = Math.floor(availableW / 7);
  const cellSize = Math.max(4, Math.min(cellByH, cellByW));

  const labelFontSize = Math.max(7, Math.floor(cellSize * 0.6));

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 8, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Год в пикселях</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={[styles.yearNav, { borderBottomColor: theme.border }]}>
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
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: theme.mutedForeground, fontSize: 16 }}>Загрузка…</Text>
        </View>
      ) : (
        <View style={{ paddingHorizontal: H_PAD, paddingTop: 6 }}>
          <View style={[styles.dowRow, { marginLeft: MONTH_LABEL_W }]}>
            {DOW_LABELS.map((d, i) => (
              <View
                key={d}
                style={{
                  width: cellSize,
                  alignItems: "center",
                  marginRight: i < 6 ? GAP : 0,
                }}
              >
                <Text style={{ color: theme.mutedForeground, fontSize: labelFontSize, fontWeight: "600" }}>
                  {d}
                </Text>
              </View>
            ))}
          </View>

          {rows.map((row, ri) => {
            const monthLabel = getMonthLabelForRow(row);
            return (
              <View key={ri} style={[styles.gridRow, { marginTop: GAP }]}>
                <View style={{ width: MONTH_LABEL_W, height: cellSize, justifyContent: "center" }}>
                  {monthLabel && (
                    <Text
                      style={{
                        color: theme.mutedForeground,
                        fontSize: labelFontSize,
                        fontWeight: "600",
                      }}
                      numberOfLines={1}
                    >
                      {monthLabel}
                    </Text>
                  )}
                </View>
                {row.map((date, di) => {
                  if (!date) {
                    return (
                      <View
                        key={di}
                        style={{ width: cellSize, height: cellSize, marginRight: di < 6 ? GAP : 0 }}
                      />
                    );
                  }
                  const entry = entryMap.get(date);
                  const isToday = date === todayString;
                  const bgColor = entry
                    ? getMoodColor(entry.mood)
                    : isDark
                    ? "#2a2a2a"
                    : "#e5e5e5";

                  return (
                    <TouchableOpacity
                      key={di}
                      style={{
                        width: cellSize,
                        height: cellSize,
                        backgroundColor: bgColor,
                        borderRadius: Math.max(1, Math.floor(cellSize * 0.2)),
                        borderWidth: isToday ? Math.max(1, Math.floor(cellSize * 0.13)) : 0,
                        borderColor: isToday ? theme.foreground : "transparent",
                        marginRight: di < 6 ? GAP : 0,
                      }}
                      onPress={() => {
                        if (entry) {
                          router.push({ pathname: "/day-detail", params: { date } });
                        } else {
                          // future dates have no cell (filtered), only past empty days reach here
                          showToast("В этот день нет записи");
                        }
                      }}
                      activeOpacity={0.75}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      {/* Toast */}
      {toast !== null && (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: isDark ? "#333" : "#222", bottom: bottomPad + 24 },
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
  dowRow: { flexDirection: "row", marginBottom: 2 },
  gridRow: { flexDirection: "row" },
  toast: {
    position: "absolute",
    alignSelf: "center",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastText: { color: "#fff", fontSize: 14, fontWeight: "500" },
});
