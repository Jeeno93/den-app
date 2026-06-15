import React, { useEffect, useRef, useState } from "react";
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

const MONTH_LABELS = [
  "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
  "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек",
];

function getCalendarMoodColor(mood: number): string {
  if (mood <= 2) return "#FF6767";
  if (mood === 3) return "#C7CDD4";
  return "#5EE6A8";
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export default function YearPixelsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();

  const now = new Date();
  const currentYear = now.getFullYear();
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

  const H_PAD = 12;
  const MONTH_W = 28;
  const MONTH_GAP = 3;
  const CELL_GAP = 1;
  const gridWidth = screenWidth - H_PAD * 2 - MONTH_W - MONTH_GAP;
  const cellSize = Math.floor((gridWidth - CELL_GAP * 30) / 31);

  return (
    <View style={{ flex: 1, backgroundColor: "#06080B" }}>
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: "#06080B", borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Год в пикселях</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={[styles.yearNav, { borderBottomColor: theme.border, backgroundColor: "#06080B" }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setYear((y) => y - 1)} activeOpacity={0.7}>
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
        <View
          style={{
            flex: 1,
            backgroundColor: "#06080B",
            paddingHorizontal: H_PAD,
            paddingTop: 10,
            paddingBottom: bottomPad + 16,
          }}
        >
          {/* Day-number header row */}
          <View style={{ flexDirection: "row", marginLeft: MONTH_W + MONTH_GAP, marginBottom: 4 }}>
            {Array.from({ length: 31 }, (_, i) => (
              <View
                key={i}
                style={{ width: cellSize, marginLeft: i > 0 ? CELL_GAP : 0, alignItems: "center" }}
              >
                <Text style={{ fontSize: 7, color: "#6B7585" }}>{i + 1}</Text>
              </View>
            ))}
          </View>

          {/* Month rows — flex distributes vertical space evenly */}
          <View style={{ flex: 1, justifyContent: "space-evenly" }}>
            {MONTH_LABELS.map((label, monthIdx) => {
              const dim = daysInMonth(year, monthIdx);
              return (
                <View key={monthIdx} style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    style={{
                      width: MONTH_W,
                      fontSize: 10,
                      color: "#6B7585",
                      fontWeight: "500",
                    }}
                  >
                    {label}
                  </Text>
                  <View style={{ width: MONTH_GAP }} />
                  {Array.from({ length: 31 }, (_, dayIdx) => {
                    const dayNum = dayIdx + 1;

                    if (dayNum > dim) {
                      return (
                        <View
                          key={dayIdx}
                          style={{ width: cellSize, height: cellSize, marginLeft: dayIdx > 0 ? CELL_GAP : 0 }}
                        />
                      );
                    }

                    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                    const entry = entryMap.get(dateStr);
                    const isToday = dateStr === todayString;
                    const bgColor = entry
                      ? getCalendarMoodColor(entry.mood)
                      : "rgba(255,255,255,0.06)";

                    return (
                      <TouchableOpacity
                        key={dayIdx}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          backgroundColor: bgColor,
                          borderRadius: 3,
                          marginLeft: dayIdx > 0 ? CELL_GAP : 0,
                          borderWidth: isToday ? 1.5 : 0,
                          borderColor: isToday ? "#5EE6A8" : "transparent",
                        }}
                        onPress={() => {
                          if (entry) {
                            router.push({ pathname: "/day-detail", params: { date: dateStr } });
                          }
                        }}
                        disabled={!entry}
                        activeOpacity={entry ? 0.75 : 1}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {toast !== null && (
        <Animated.View
          style={[styles.toast, { bottom: bottomPad + 24 }, { opacity: toastOpacity }]}
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
