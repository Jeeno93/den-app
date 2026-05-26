import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getAllDays, getDay, formatDate } from "@/src/storage/storage";
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

function formatShort(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
    if (!currentDate) return;
    // Reset content immediately so old entry never bleeds into new date
    setEntry(null);
    // Reload the full sorted list on every navigation — picks up newly filled days
    getAllDays().then((all) => {
      setSortedDates(all.map((e) => e.date).sort());
    });
    getDay(currentDate).then(setEntry);
  }, [currentDate]);

  const currentIdx = sortedDates.indexOf(currentDate);
  const prevDate = currentIdx > 0 ? sortedDates[currentIdx - 1] : null;
  const nextDate = currentIdx < sortedDates.length - 1 ? sortedDates[currentIdx + 1] : null;

  const todayStr = formatDate(new Date());
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yesterdayStr = formatDate(yd);
  const td = new Date(); td.setDate(td.getDate() + 1);
  const tomorrowStr = formatDate(td);

  const prevLabel = prevDate ? (prevDate === yesterdayStr ? "вчера" : formatShort(prevDate)) : null;
  const nextLabel = nextDate ? (nextDate === tomorrowStr ? "завтра" : formatShort(nextDate)) : null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* ── Top header: back button + date title ── */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 10, backgroundColor: theme.background, borderBottomColor: theme.border },
        ]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.mutedForeground} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerDate, { color: theme.foreground }]}>
            {currentDate ? formatDateRu(currentDate) : "…"}
          </Text>
          <Text style={[styles.headerWeekday, { color: theme.mutedForeground }]}>
            {currentDate ? formatWeekday(currentDate) : ""}
          </Text>
        </View>

        {/* Placeholder to keep title centered */}
        <View style={styles.backBtn} />
      </View>

      {/* ── Day navigation bar: ← вчера … завтра → ── */}
      <View style={[styles.dayNav, { backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.dayNavBtn, !prevDate && styles.dayNavBtnDisabled]}
          onPress={() => prevDate && setCurrentDate(prevDate)}
          disabled={!prevDate}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color={prevDate ? theme.primary : theme.border} />
          {prevLabel && <Text style={[styles.dayNavLabel, { color: theme.primary }]}>{prevLabel}</Text>}
        </TouchableOpacity>

        <View style={styles.dayNavCenter} />

        <TouchableOpacity
          style={[styles.dayNavBtn, !nextDate && styles.dayNavBtnDisabled]}
          onPress={() => nextDate && setCurrentDate(nextDate)}
          disabled={!nextDate}
          activeOpacity={0.7}
        >
          {nextLabel && <Text style={[styles.dayNavLabel, { color: theme.primary }]}>{nextLabel}</Text>}
          <Ionicons name="arrow-forward" size={22} color={nextDate ? theme.primary : theme.border} />
        </TouchableOpacity>
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
  // Top header — back + date title
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 0,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
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
  // Day navigation bar
  dayNav: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  dayNavBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  dayNavBtnDisabled: {
    opacity: 0.3,
  },
  dayNavLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  dayNavCenter: {
    flex: 1,
  },
});
