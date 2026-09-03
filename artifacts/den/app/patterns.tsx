import * as amplitude from "@amplitude/analytics-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getAllDays, getTags } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import {
  computeMoodDistribution,
  computeTagFrequency,
  computeWeekdayRhythms,
} from "@/src/utils/moodPatterns";
import { MoodTrendChart, MoodDistributionDonut, TagFrequencyBars } from "@/src/components/PatternCharts";

const MAX_TAG_FREQ_SHOWN = 8;
const MAX_RHYTHMS_SHOWN = 5;

const RANGE_PRESETS: { label: string; days: number | null }[] = [
  { label: "Неделя", days: 7 },
  { label: "Месяц", days: 30 },
  { label: "3 месяца", days: 90 },
  { label: "Всё время", days: null },
];

const WEEKDAY_DATIVE_PLURAL: Record<string, string> = {
  "Воскресенье": "воскресеньям",
  "Понедельник": "понедельникам",
  "Вторник": "вторникам",
  "Среда": "средам",
  "Четверг": "четвергам",
  "Пятница": "пятницам",
  "Суббота": "субботам",
};

export default function PatternsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [allDays, setAllDays] = useState<DayEntry[]>([]);
  const [tagList, setTagList] = useState<{ id: string; label: string; emoji: string }[]>([]);
  const [rangeDays, setRangeDays] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      amplitude.track("patterns_viewed");
      let cancelled = false;
      (async () => {
        const [days, tags] = await Promise.all([getAllDays(), getTags()]);
        if (cancelled) return;
        setAllDays(days);
        setTagList([...tags.places, ...tags.activities]);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  // Расчёты держим в useMemo от (записи + период), а не в состоянии: смена
  // пресета не должна ходить в хранилище заново, данные уже в памяти.
  const view = useMemo(() => {
    const tagLookup = new Map(tagList.map((t) => [t.id, t]));

    let entries = allDays;
    if (rangeDays !== null) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - rangeDays);
      const cutoffIso = cutoff.toISOString().slice(0, 10);
      entries = allDays.filter((e) => e.date >= cutoffIso);
    }

    const tagFreqRows = computeTagFrequency(entries)
      .map((f) => {
        const tag = tagLookup.get(f.id);
        return tag ? { id: f.id, emoji: tag.emoji, label: tag.label, count: f.count } : null;
      })
      .filter((r): r is { id: string; emoji: string; label: string; count: number } => r !== null)
      .slice(0, MAX_TAG_FREQ_SHOWN);

    const rhythms = computeWeekdayRhythms(entries)
      .map((r) => {
        const tag = tagLookup.get(r.tagId);
        return tag ? { ...r, label: tag.label, emoji: tag.emoji } : null;
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .slice(0, MAX_RHYTHMS_SHOWN);

    return {
      entries,
      totalEntries: entries.length,
      tagFreqRows,
      rhythms,
      moodDistribution: computeMoodDistribution(entries),
    };
  }, [allDays, tagList, rangeDays]);

  const { entries, totalEntries, tagFreqRows, rhythms, moodDistribution } = view;

  return (
    <View style={{ flex: 1, backgroundColor: "#06080B" }}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Паттерны</Text>
        <View style={styles.iconBtn} />
      </View>

      {/* Пресеты держим вне ScrollView и вне условий: если в выбранном окне
          данных не хватило, переключиться обратно должно быть можно прямо
          с экрана "пока рано", не уходя назад. */}
      <View style={styles.rangeRow}>
        {RANGE_PRESETS.map((preset) => {
          const isActive = rangeDays === preset.days;
          return (
            <TouchableOpacity
              key={preset.label}
              onPress={() => setRangeDays(preset.days)}
              activeOpacity={0.7}
              style={[
                styles.rangePill,
                { borderColor: theme.border },
                isActive && { backgroundColor: "#31A876", borderColor: "#31A876" },
              ]}
            >
              <Text
                style={[
                  styles.rangePillText,
                  { color: isActive ? "#06080B" : theme.mutedForeground },
                  isActive && { fontWeight: "700" },
                ]}
              >
                {preset.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: theme.mutedForeground }}>Загрузка…</Text>
        </View>
      ) : totalEntries < 2 ? (
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Пока рано</Text>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            За этот период почти нет записей.{"\n"}
            Попробуй выбрать период подлиннее — или{"\n"}
            просто продолжай вести дневник.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MoodTrendChart entries={entries} theme={theme} />
          </View>
          <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <MoodDistributionDonut distribution={moodDistribution} theme={theme} />
          </View>
          {tagFreqRows.length > 0 && (
            <View style={[styles.chartCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TagFrequencyBars rows={tagFreqRows} theme={theme} />
            </View>
          )}

          {rhythms.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Твой недельный ритм</Text>
              {rhythms.map((r) => (
                <View
                  key={`${r.tagId}:${r.weekday}`}
                  style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}
                >
                  <View style={styles.rowHeader}>
                    <Text style={styles.rowEmoji}>{r.emoji}</Text>
                    <Text style={[styles.rowInsight, { color: theme.foreground }]}>
                      «{r.label}» — чаще всего по {WEEKDAY_DATIVE_PLURAL[r.weekday] ?? r.weekday.toLowerCase()}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[styles.barFill, { width: `${Math.round(r.rate * 100)}%`, backgroundColor: "#31A876" }]}
                    />
                  </View>
                  <Text style={[styles.rowShare, { color: theme.mutedForeground }]}>
                    {r.hits} из {r.total} — это {Math.round(r.rate * 100)}%, против {Math.round(r.overallRate * 100)}% по всем дням
                  </Text>
                </View>
              ))}
              <Text style={[styles.explainer, { color: theme.mutedForeground }]}>
                Здесь только те совпадения, которые не объясняются случайностью: каждое
                проверяется тем, что те же дни много раз раскладываются по неделе наугад.
              </Text>
            </>
          )}
        </ScrollView>
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
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 4,
  },
  rangePill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  rangePillText: { fontSize: 13, fontWeight: "500" },
  container: {
    padding: 20,
    gap: 12,
  },
  chartCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    opacity: 0.7,
    marginTop: 8,
    marginBottom: 2,
  },
  explainer: { fontSize: 12.5, lineHeight: 18, marginTop: 4, opacity: 0.9 },
  row: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rowEmoji: { fontSize: 18 },
  rowInsight: { fontSize: 15, fontWeight: "600", flex: 1, lineHeight: 21 },
  barTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 4,
  },
  rowShare: { fontSize: 12.5, fontWeight: "500" },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center" },
});
