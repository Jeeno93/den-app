import React, { useCallback, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodColor } from "@/src/components/MoodPicker";

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

export default function CalendarScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    const all = await getAllDays();
    const map: Record<string, DayEntry> = {};
    for (const e of all) {
      map[e.date] = e;
    }
    setEntries(map);
  }

  function prevMonth() {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  }

  function getDaysInMonth(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate();
  }

  function getFirstDayOfWeek(y: number, m: number) {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1;
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = formatDate(now);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  function handleDayPress(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (entries[dateStr]) {
      router.push({ pathname: "/day-detail", params: { date: dateStr } });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} testID="prev-month">
          <Ionicons name="chevron-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: theme.foreground }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} testID="next-month">
          <Ionicons name="chevron-forward" size={22} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.weekRow}>
          {WEEK_DAYS.map((d) => (
            <Text key={d} style={[styles.weekDay, { color: theme.mutedForeground }]}>
              {d}
            </Text>
          ))}
        </View>

        {weeks.map((week, wi) => (
          <View key={wi} style={styles.weekRow}>
            {week.map((day, di) => {
              if (day === null) {
                return <View key={di} style={styles.dayCell} />;
              }
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const entry = entries[dateStr];
              const isToday = dateStr === today;

              return (
                <TouchableOpacity
                  key={di}
                  style={[styles.dayCell, { alignItems: "center", justifyContent: "center" }]}
                  onPress={() => handleDayPress(day)}
                  disabled={!entry}
                  activeOpacity={entry ? 0.7 : 1}
                  testID={`day-${day}`}
                >
                  <View
                    style={[
                      styles.dayDot,
                      {
                        backgroundColor: entry
                          ? getMoodColor(entry.mood)
                          : "transparent",
                        borderWidth: isToday ? 2 : 0,
                        borderColor: isToday ? theme.primary : "transparent",
                      },
                    ]}
                  >
                    {!entry && (
                      <View
                        style={[
                          styles.emptyDot,
                          { backgroundColor: isToday ? theme.primary + "30" : theme.border },
                        ]}
                      />
                    )}
                  </View>
                  <Text
                    style={[
                      styles.dayNum,
                      {
                        color: isToday ? theme.primary : theme.foreground,
                        fontWeight: isToday ? "700" : "400",
                      },
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        <View style={[styles.legend, { borderTopColor: theme.border }]}>
          <Text style={[styles.legendTitle, { color: theme.mutedForeground }]}>Цвета настроения</Text>
          <View style={styles.legendRow}>
            {[
              { color: "#7B8FA1", label: "Плохо" },
              { color: "#A8B5C1", label: "Нейтр." },
              { color: "#90C8A8", label: "Хорошо" },
              { color: "#5BAD8F", label: "Отлично" },
              { color: "#3D9970", label: "Супер" },
            ].map((item) => (
              <View key={item.color} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                <Text style={[styles.legendLabel, { color: theme.mutedForeground }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  navBtn: {
    padding: 8,
    borderRadius: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  weekDay: {
    width: 44,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayCell: {
    width: 44,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dayDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dayNum: {
    fontSize: 12,
  },
  legend: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    paddingHorizontal: 8,
    gap: 10,
  },
  legendTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 12,
  },
});
