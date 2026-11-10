import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as amplitude from "@amplitude/analytics-react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays, getAllPeriodReflections, getAllReflections } from "@/src/storage/storage";
import { MONTHS_NOMINATIVE, plural } from "@/src/utils/entryText";
import { formatWeekRange, weekStartOf } from "@/src/utils/weeklySummary";

type Theme = typeof colors.dark;

interface WeekRow { kind: "week"; period: string; label: string; entries: number }
interface MonthRow { kind: "month"; period: string; label: string; entries: number }
interface YearRow { kind: "year"; period: string; label: string; entries: number }

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS_NOMINATIVE[m - 1]} ${y}`;
}

/**
 * Архив итогов: любая прошедшая неделя, месяц или год с записями (или
 * заполненной рефлексией) доступны в любой момент — не только в окно вс–вт
 * и не один раз. Текущие незакончившиеся периоды сюда не попадают: месяц и
 * год подводятся по окончании, неделя текущая — через карточку на «Сегодня».
 */
export default function SummariesScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const [weeks, setWeeks] = useState<WeekRow[]>([]);
  const [months, setMonths] = useState<MonthRow[]>([]);
  const [years, setYears] = useState<YearRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [all, weekReflections, monthReflections, yearReflections] = await Promise.all([
        getAllDays(),
        getAllReflections(),
        getAllPeriodReflections("month"),
        getAllPeriodReflections("year"),
      ]);
      if (cancelled) return;

      const today = formatDate(new Date());
      const currentWeek = weekStartOf(today);
      const currentMonth = today.slice(0, 7);
      const currentYear = today.slice(0, 4);

      // Недели: группировка по понедельнику.
      const weekCounts = new Map<string, number>();
      const monthEntries = new Map<string, number>();
      const yearEntries = new Map<string, number>();
      for (const e of all) {
        const w = weekStartOf(e.date);
        weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
      }
      for (const r of weekReflections) {
        if (!weekCounts.has(r.weekStart)) weekCounts.set(r.weekStart, 0);
      }
      const weekRows: WeekRow[] = [...weekCounts.entries()]
        .filter(([start]) => start <= currentWeek)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([start, count]) => ({ kind: "week", period: start, label: formatWeekRange(start), entries: count }));

      for (const e of all) {
        const m = e.date.slice(0, 7);
        monthEntries.set(m, (monthEntries.get(m) ?? 0) + 1);
        const y = e.date.slice(0, 4);
        yearEntries.set(y, (yearEntries.get(y) ?? 0) + 1);
      }
      for (const r of monthReflections) {
        if (!monthEntries.has(r.period)) monthEntries.set(r.period, 0);
      }
      for (const r of yearReflections) {
        if (!yearEntries.has(r.period)) yearEntries.set(r.period, 0);
      }

      const monthRows: MonthRow[] = [...monthEntries.entries()]
        .filter(([period]) => period < currentMonth)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([period, count]) => ({ kind: "month", period, label: monthLabel(period), entries: count }));

      const yearRows: YearRow[] = [...yearEntries.entries()]
        .filter(([period]) => period < currentYear)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([period, count]) => ({ kind: "year", period, label: period, entries: count }));

      setWeeks(weekRows);
      setMonths(monthRows);
      setYears(yearRows);
      amplitude.track("summaries_viewed", {
        weeks: weekRows.length,
        months: monthRows.length,
        years: yearRows.length,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isEmpty = weeks.length === 0 && months.length === 0 && years.length === 0;

  function openRow(row: WeekRow | MonthRow | YearRow) {
    amplitude.track("summaries_opened", { kind: row.kind, period: row.period });
    if (row.kind === "week") {
      router.push({ pathname: "/week-summary", params: { start: row.period, source: "archive" } } as any);
    } else {
      router.push({ pathname: "/period-summary", params: { kind: row.kind, period: row.period, source: "archive" } } as any);
    }
  }

  function Row({ row }: { row: WeekRow | MonthRow | YearRow }) {
    return (
      <TouchableOpacity
        style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
        onPress={() => openRow(row)}
        activeOpacity={0.7}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, { color: theme.foreground }]}>{row.label}</Text>
          <Text style={[styles.rowSub, { color: theme.mutedForeground }]}>
            {row.entries > 0
              ? `${row.entries} ${plural(row.entries, ["запись", "записи", "записей"])}`
              : "Только твой итог"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Вехи</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {isEmpty && (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              Здесь появятся вехи — итоги твоих недель, месяцев и годов. Записывай дни, архив наполнится сам.
            </Text>
          </View>
        )}

        {weeks.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>По неделям</Text>
            {weeks.map((w) => (
              <Row key={w.period} row={w} />
            ))}
          </View>
        )}

        {months.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>По месяцам</Text>
            {months.map((m) => (
              <Row key={m.period} row={m} />
            ))}
          </View>
        )}

        {years.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>По годам</Text>
            {years.map((y) => (
              <Row key={y.period} row={y} />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  headerCenter: { flex: 1, alignItems: "center", gap: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 18 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  rowTitle: { fontSize: 15, fontWeight: "600" },
  rowSub: { fontSize: 13, marginTop: 2 },
});
