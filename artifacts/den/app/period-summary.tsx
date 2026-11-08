import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as amplitude from "@amplitude/analytics-react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays, getTags, type PeriodKind } from "@/src/storage/storage";
import { ReflectionBlock } from "@/src/components/ReflectionBlock";
import { isValidMood } from "@/src/utils/mood";
import { MONTHS_NOMINATIVE, plural, tagLookup } from "@/src/utils/entryText";

type Theme = typeof colors.dark;

function Section({ title, theme, children }: { title: string; theme: Theme; children: React.ReactNode }) {
  return (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{title}</Text>
      {children}
    </View>
  );
}

function periodLabel(kind: PeriodKind, period: string): string {
  if (kind === "month") {
    const [y, m] = period.split("-").map(Number);
    return `${MONTHS_NOMINATIVE[m - 1]} ${y}`;
  }
  return period;
}

/**
 * Итоги месяца или года: короткая автоматическая сводка (записи, среднее
 * настроение, частые теги) + свободная рефлексия. Доступен только за
 * закончившиеся периоды — подводить итоги незаконченного месяца или года
 * рано, это половинчатый снимок.
 */
export default function PeriodSummaryScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ kind?: string; period?: string; source?: string }>();
  const kind: PeriodKind = params.kind === "year" ? "year" : "month";
  const period = params.period ?? "";

  const [loaded, setLoaded] = useState<{
    period: string;
    ended: boolean;
    entries: number;
    avgMood: number | null;
    topTags: { emoji: string; label: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = formatDate(new Date());
      const currentPeriod = kind === "month" ? today.slice(0, 7) : today.slice(0, 4);
      const ended = period < currentPeriod;
      if (!ended) {
        if (!cancelled) setLoaded({ period, ended, entries: 0, avgMood: null, topTags: [] });
        return;
      }
      const [all, tags] = await Promise.all([getAllDays(), getTags()]);
      if (cancelled) return;
      const entries = all.filter((e) =>
        kind === "month" ? e.date.slice(0, 7) === period : e.date.startsWith(period)
      );
      const moods = entries.map((e) => e.mood).filter(isValidMood);
      const avgMood = moods.length > 0 ? moods.reduce((s, v) => s + v, 0) / moods.length : null;

      const lookup = tagLookup(tags);
      const tagCounts = new Map<string, number>();
      for (const e of entries) {
        for (const id of new Set([...e.places, ...e.activities])) {
          tagCounts.set(id, (tagCounts.get(id) ?? 0) + 1);
        }
      }
      const topTags = [...tagCounts.entries()]
        .filter(([, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([id, count]) => {
          const info = lookup(id);
          return info ? { ...info, count } : null;
        })
        .filter((t): t is { emoji: string; label: string; count: number } => t !== null)
        .slice(0, 3);

      if (!cancelled) {
        setLoaded({ period, ended, entries: entries.length, avgMood, topTags });
        amplitude.track("period_summary_viewed", {
          kind,
          period,
          entries: entries.length,
          source: params.source || "direct",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, period]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={theme.mutedForeground} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.foreground }]}>
            {kind === "month" ? "Итоги месяца" : "Итоги года"}
          </Text>
          {loaded && (
            <Text style={[styles.headerSub, { color: theme.mutedForeground }]}>{periodLabel(kind, loaded.period)}</Text>
          )}
        </View>
        <View style={styles.backBtn} />
      </View>

      {loaded && !loaded.ended && (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            {kind === "month" ? "Этот месяц ещё не закончился." : "Этот год ещё не закончился."} Итоги появятся, когда
            период завершится.
          </Text>
        </View>
      )}

      {loaded && loaded.ended && (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
          <ReflectionBlock kind={kind} period={loaded.period} theme={theme} />

          {loaded.entries > 0 ? (
            <Section
              title={`${loaded.entries} ${plural(loaded.entries, ["запись", "записи", "записей"])}`}
              theme={theme}
            >
              {loaded.avgMood !== null && (
                <Text style={[styles.body, { color: theme.foreground }]}>
                  Среднее настроение: {loaded.avgMood.toFixed(1)} из 5
                </Text>
              )}
              {loaded.topTags.length > 0 && (
                <View style={styles.tagsRow}>
                  {loaded.topTags.map((tag) => (
                    <View key={tag.label} style={[styles.tagChip, { backgroundColor: theme.secondary }]}>
                      <Text style={[styles.tagText, { color: theme.foreground }]}>
                        {tag.emoji} {tag.label} · {tag.count}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Section>
          ) : (
            <Text style={[styles.hint, { color: theme.mutedForeground }]}>
              В этом периоде нет записей дней — только твой итог.
            </Text>
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
  section: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  body: { fontSize: 15, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14 },
  tagText: { fontSize: 14 },
  hint: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  footer: { fontSize: 12, textAlign: "center", marginTop: 6, lineHeight: 17 },
});
