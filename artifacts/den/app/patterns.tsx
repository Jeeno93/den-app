import * as amplitude from "@amplitude/analytics-react-native";
import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getAllDays, getTags } from "@/src/storage/storage";
import type { UserTags } from "@/src/storage/storage";
import { computeMoodPatterns } from "@/src/utils/moodPatterns";
import type { MoodPattern } from "@/src/utils/moodPatterns";

// Минимум записей, при котором корреляции вообще имеют смысл показывать —
// как у Daylio: первые содержательные паттерны проявляются примерно к
// двум неделям ведения дневника, не раньше.
const MIN_ENTRIES = 10;
const MAX_SHOWN = 8;

interface ResolvedPattern extends MoodPattern {
  label: string;
  emoji: string;
}

export default function PatternsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [totalEntries, setTotalEntries] = useState(0);
  const [patterns, setPatterns] = useState<ResolvedPattern[]>([]);

  useFocusEffect(
    useCallback(() => {
      amplitude.track("patterns_viewed");
      let cancelled = false;
      (async () => {
        const [entries, tags] = await Promise.all([getAllDays(), getTags()]);
        if (cancelled) return;
        const allTags = [...tags.places, ...tags.activities];
        const resolved = computeMoodPatterns(entries)
          .map((p) => {
            const tag = allTags.find((t) => t.id === p.tag);
            return tag ? { ...p, label: tag.label, emoji: tag.emoji } : null;
          })
          .filter((p): p is ResolvedPattern => p !== null)
          .slice(0, MAX_SHOWN);
        setTotalEntries(entries.length);
        setPatterns(resolved);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const maxAbsDelta = Math.max(0.01, ...patterns.map((p) => Math.abs(p.delta)));

  return (
    <View style={{ flex: 1, backgroundColor: "#06080B" }}>
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.foreground }]}>Паттерны</Text>
        <View style={styles.iconBtn} />
      </View>

      {loading ? (
        <View style={styles.centerWrap}>
          <Text style={{ color: theme.mutedForeground }}>Загрузка…</Text>
        </View>
      ) : totalEntries < MIN_ENTRIES ? (
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Пока рано</Text>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            Паттерны становятся заметны примерно через {MIN_ENTRIES} записей.{"\n"}
            Сейчас их {totalEntries} — продолжай, и здесь появится связь{"\n"}
            между тем, чем ты занимаешься, и твоим настроением.
          </Text>
        </View>
      ) : patterns.length === 0 ? (
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏷️</Text>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Пока нет тегов</Text>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            Добавляй места и активности к записям —{"\n"}
            когда один и тот же тег встретится хотя бы 3 раза,{"\n"}
            здесь появится, как он связан с твоим настроением.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Text style={[styles.intro, { color: theme.mutedForeground }]}>
            Как разные теги связаны с твоим настроением — среднее в дни с тегом
            по сравнению с обычным днём.
          </Text>

          {patterns.map((p) => {
            const isPositive = p.delta >= 0;
            const barColor = isPositive ? "#31A876" : "#E68A78";
            const barWidthPct = (Math.abs(p.delta) / maxAbsDelta) * 100;
            return (
              <View key={p.tag} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowEmoji}>{p.emoji}</Text>
                  <Text style={[styles.rowLabel, { color: theme.foreground }]}>{p.label}</Text>
                  <Text style={[styles.rowDelta, { color: barColor }]}>
                    {isPositive ? "+" : ""}{p.delta.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${Math.max(barWidthPct, 4)}%`,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.rowCount, { color: theme.mutedForeground }]}>
                  {p.count} {p.count === 1 ? "день" : "дней"}
                </Text>
              </View>
            );
          })}
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
  container: {
    padding: 20,
    gap: 12,
  },
  intro: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  row: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rowEmoji: { fontSize: 18 },
  rowLabel: { fontSize: 15, fontWeight: "600", flex: 1 },
  rowDelta: { fontSize: 15, fontWeight: "700" },
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
  rowCount: { fontSize: 12 },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center" },
});
