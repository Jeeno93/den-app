import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as amplitude from "@amplitude/analytics-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays, getTags } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji } from "@/src/components/MoodPicker";
import { MaskView } from "@/src/components/MaskView";
import { WEEKDAYS_CAPITAL, formatDayMonth, parseDay, plural, tagLookup } from "@/src/utils/entryText";
import {
  buildWeeklySummary,
  formatWeekRange,
  summaryComparison,
  summaryHeadline,
  summaryWeekFor,
  weekStartOf,
  weeklyViewedKey,
  type WeeklySummary,
} from "@/src/utils/weeklySummary";

const DOW_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

type Theme = typeof colors.dark;

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function openDay(date: string) {
  router.push({ pathname: "/day-detail", params: { date } } as any);
}

export default function WeekSummaryScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ start?: string; source?: string }>();
  const [loaded, setLoaded] = useState<{ start: string; summary: WeeklySummary | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const todayStr = formatDate(new Date());
      const start = params.start || summaryWeekFor(todayStr) || weekStartOf(todayStr);
      const [all, tags] = await Promise.all([getAllDays(), getTags()]);
      if (cancelled) return;
      const summary = buildWeeklySummary(all, start, tagLookup(tags));
      setLoaded({ start, summary });
      if (summary) {
        await AsyncStorage.setItem(weeklyViewedKey(start), "1").catch(() => {});
        amplitude.track("weekly_summary_viewed", {
          week_start: start,
          entries: summary.entryCount,
          source: params.source || "direct",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [params.start]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const summary = loaded?.summary ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>Итоги недели</Text>
          {loaded && (
            <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>{formatWeekRange(loaded.start)}</Text>
          )}
        </View>
        <View style={styles.backBtn} />
      </View>

      {loaded && !summary && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            На этой неделе пока меньше трёх записей. Итоги появятся, когда записей станет больше.
          </Text>
        </View>
      )}

      {summary && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <Text style={[styles.headline, { color: theme.foreground }]}>{summaryHeadline(summary)}</Text>
          {summaryComparison(summary) && (
            <Text style={[styles.comparison, { color: theme.mutedForeground }]}>{summaryComparison(summary)}</Text>
          )}

          <Section
            title={`${summary.entryCount} ${plural(summary.entryCount, ["запись", "записи", "записей"])} из 7 дней`}
            theme={theme}
          >
            <View style={styles.daysRow}>
              {summary.days.map((day, i) => (
                <TouchableOpacity
                  key={day.date}
                  style={styles.daySlot}
                  disabled={day.mood === null}
                  onPress={() => openDay(day.date)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayDot,
                      day.mood === null
                        ? { borderColor: theme.border }
                        : { borderColor: getMoodColor(day.mood), backgroundColor: getMoodColor(day.mood) + "33" },
                    ]}
                  >
                    {day.mood !== null && <Text style={styles.dayEmoji}>{getMoodEmoji(day.mood)}</Text>}
                  </View>
                  <Text style={[styles.dayLabel, { color: theme.mutedForeground }]}>{DOW_SHORT[i]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Section>

          {summary.brightest && (
            <Section title="Самый светлый день" theme={theme}>
              <TouchableOpacity onPress={() => openDay(summary.brightest!.date)} activeOpacity={0.7} style={styles.quoteBlock}>
                <Text style={[styles.quoteDate, { color: theme.foreground }]}>
                  {getMoodEmoji(summary.brightest.mood)} {WEEKDAYS_CAPITAL[parseDay(summary.brightest.date).getDay()]},{" "}
                  {formatDayMonth(summary.brightest.date)}
                </Text>
                {summary.brightest.quote && (
                  <MaskView>
                    {summary.brightest.quoteSource && (
                      <Text style={[styles.quoteSource, { color: theme.mutedForeground }]}>{summary.brightest.quoteSource}</Text>
                    )}
                    <Text style={[styles.quote, { color: theme.foreground }]}>«{summary.brightest.quote}»</Text>
                  </MaskView>
                )}
              </TouchableOpacity>
            </Section>
          )}

          {summary.topTags.length > 0 && (
            <Section title="Чаще всего" theme={theme}>
              <View style={styles.tagsRow}>
                {summary.topTags.map((tag) => (
                  <View key={tag.label} style={[styles.tagChip, { backgroundColor: theme.secondary }]}>
                    <Text style={[styles.tagText, { color: theme.foreground }]}>
                      {tag.emoji} {tag.label} · {tag.count}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          )}

          {summary.tasks && (
            <Section title="Задачи на завтра" theme={theme}>
              <Text style={[styles.body, { color: theme.foreground }]}>
                Запланировано {summary.tasks.planned} {plural(summary.tasks.planned, ["задача", "задачи", "задач"])}, отмечено
                выполненными {summary.tasks.done}.
              </Text>
            </Section>
          )}

          {summary.extraQuote && (
            <Section title="Из твоих записей" theme={theme}>
              <TouchableOpacity onPress={() => openDay(summary.extraQuote!.date)} activeOpacity={0.7} style={styles.quoteBlock}>
                <Text style={[styles.quoteDateMuted, { color: theme.mutedForeground }]}>
                  {WEEKDAYS_CAPITAL[parseDay(summary.extraQuote.date).getDay()]}, {formatDayMonth(summary.extraQuote.date)}
                </Text>
                <MaskView>
                  <Text style={[styles.quoteSource, { color: theme.mutedForeground }]}>{summary.extraQuote.source}</Text>
                  <Text style={[styles.quote, { color: theme.foreground }]}>«{summary.extraQuote.text}»</Text>
                </MaskView>
              </TouchableOpacity>
            </Section>
          )}

          <Text style={[styles.footer, { color: theme.mutedForeground }]}>
            Итоги собраны на твоём телефоне из твоих записей и никуда не отправляются.
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 10 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 18 },
  headerCenter: { flex: 1, alignItems: "center", gap: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  content: { paddingHorizontal: 20, paddingTop: 12, gap: 14 },
  headline: { fontSize: 24, fontWeight: "700", letterSpacing: -0.4, lineHeight: 30 },
  comparison: { fontSize: 15, marginTop: -6 },
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  daysRow: { flexDirection: "row", justifyContent: "space-between" },
  daySlot: { alignItems: "center", gap: 6 },
  dayDot: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  dayEmoji: { fontSize: 16 },
  dayLabel: { fontSize: 10, fontWeight: "600", textTransform: "uppercase" },
  quoteBlock: { gap: 6 },
  quoteDate: { fontSize: 15, fontWeight: "600" },
  quoteDateMuted: { fontSize: 13 },
  quoteSource: { fontSize: 12, marginBottom: 2 },
  quote: { fontSize: 15, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  tagText: { fontSize: 14 },
  body: { fontSize: 15, lineHeight: 22 },
  footer: { fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 17 },
});
