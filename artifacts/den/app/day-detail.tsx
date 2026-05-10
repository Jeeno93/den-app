import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getAllDays, getDay } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { DayEntryView } from "@/src/components/DayEntry";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatWeekday(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return WEEKDAYS[d.getDay()];
}

export default function DayDetailScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { date: initialDate } = useLocalSearchParams<{ date: string }>();

  const [currentDate, setCurrentDate] = useState<string>(initialDate ?? "");
  const [entry, setEntry] = useState<DayEntry | null>(null);
  const [sortedDates, setSortedDates] = useState<string[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    async function loadAll() {
      const all = await getAllDays();
      const dates = all.map((e) => e.date).sort();
      setSortedDates(dates);
    }
    loadAll();
  }, []);

  useEffect(() => {
    if (!currentDate) return;
    setEntry(null);
    getDay(currentDate).then(setEntry);
  }, [currentDate]);

  const currentIdx = sortedDates.indexOf(currentDate);
  const prevDate = currentIdx > 0 ? sortedDates[currentIdx - 1] : null;
  const nextDate = currentIdx < sortedDates.length - 1 ? sortedDates[currentIdx + 1] : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity style={styles.sideBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerDate, { color: theme.foreground }]}>
            {currentDate ? formatDateRu(currentDate) : "…"}
          </Text>
          <Text style={[styles.headerWeekday, { color: theme.mutedForeground }]}>
            {currentDate ? formatWeekday(currentDate) : ""}
          </Text>
        </View>

        <View style={styles.headerNav}>
          <TouchableOpacity
            style={[styles.navBtn, !prevDate && styles.navBtnDisabled]}
            onPress={() => prevDate && setCurrentDate(prevDate)}
            disabled={!prevDate}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={prevDate ? theme.foreground : theme.border} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.navBtn, !nextDate && styles.navBtnDisabled]}
            onPress={() => nextDate && setCurrentDate(nextDate)}
            disabled={!nextDate}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-forward" size={20} color={nextDate ? theme.foreground : theme.border} />
          </TouchableOpacity>
        </View>
      </View>

      {entry ? (
        <DayEntryView key={currentDate} entry={entry} dayQuestion={entry.question} />
      ) : (
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: theme.mutedForeground }]}>Загрузка...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  sideBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 1,
  },
  headerDate: {
    fontSize: 16,
    fontWeight: "700",
  },
  headerWeekday: {
    fontSize: 12,
    fontWeight: "400",
  },
  headerNav: {
    flexDirection: "row",
    gap: 2,
  },
  navBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
});
