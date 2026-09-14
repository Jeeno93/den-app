import React, { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as amplitude from "@amplitude/analytics-react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { getAllDays, getTags } from "@/src/storage/storage";
import { plural, tagLookup } from "@/src/utils/entryText";
import {
  buildWeeklySummary,
  formatWeekRange,
  summaryWeekFor,
  weeklyViewedKey,
} from "@/src/utils/weeklySummary";

interface ThemeColors {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  primary: string;
}

/**
 * Приглашение к итогам недели на главном экране. Живёт с воскресенья по
 * вторник и исчезает, как только итоги открыли: карточка, которая висит
 * после просмотра, быстро превращается в шум.
 */
export function WeeklySummaryCard({ todayStr, theme }: { todayStr: string; theme: ThemeColors }) {
  const [week, setWeek] = useState<{ start: string; entries: number } | null>(null);
  const trackedWeek = useRef<string | null>(null);

  // Перечитываем при каждом возвращении на экран: после просмотра итогов
  // карточка должна пропасть сразу, а не после перезапуска.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const start = summaryWeekFor(todayStr);
        if (!start) {
          if (!cancelled) setWeek(null);
          return;
        }
        const [all, tags, viewed] = await Promise.all([
          getAllDays(),
          getTags(),
          AsyncStorage.getItem(weeklyViewedKey(start)),
        ]);
        if (cancelled) return;
        const summary = buildWeeklySummary(all, start, tagLookup(tags));
        if (!summary || viewed) {
          setWeek(null);
          return;
        }
        setWeek({ start, entries: summary.entryCount });
        if (trackedWeek.current !== start) {
          trackedWeek.current = start;
          amplitude.track("weekly_summary_card_shown", { week_start: start, entries: summary.entryCount });
        }
      })();
      return () => { cancelled = true; };
    }, [todayStr])
  );

  if (!week) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => {
        amplitude.track("weekly_summary_card_tapped", { week_start: week.start });
        router.push({ pathname: "/week-summary", params: { start: week.start, source: "card" } } as any);
      }}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.primary + "55" }]}
    >
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={18} color={theme.primary} />
        <Text style={[styles.title, { color: theme.foreground }]}>Итоги недели готовы</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
      </View>
      <Text style={[styles.sub, { color: theme.mutedForeground }]}>
        {formatWeekRange(week.start)} · {week.entries} {plural(week.entries, ["запись", "записи", "записей"])}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", flex: 1 },
  sub: { fontSize: 13 },
});
