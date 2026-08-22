import * as amplitude from "@amplitude/analytics-react-native";
import React, { useCallback, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getAllDays, getTags } from "@/src/storage/storage";
import { computeMoodPatterns, computeWeekdayPatterns, computeKeywordPatterns } from "@/src/utils/moodPatterns";
import type { MoodPattern, Confidence } from "@/src/utils/moodPatterns";

// Минимум записей, при котором корреляции вообще имеют смысл показывать —
// как у Daylio: первые содержательные паттерны проявляются примерно к
// двум неделям ведения дневника, не раньше.
const MIN_ENTRIES = 10;
const MAX_SHOWN = 6;

interface Row {
  key: string;
  emoji: string;
  insight: string;
  delta: number;
  count: number;
  confidence: Confidence;
}

const WEEKDAY_DATIVE_PLURAL: Record<string, string> = {
  "Воскресенье": "воскресеньям",
  "Понедельник": "понедельникам",
  "Вторник": "вторникам",
  "Среда": "средам",
  "Четверг": "четвергам",
  "Пятница": "пятницам",
  "Суббота": "субботам",
};

function confidenceLabel(c: Confidence, count: number): string {
  const word = count === 1 ? "день" : count < 5 ? "дня" : "дней";
  if (c === "low") return `по ${count} ${word} — пока мало данных`;
  if (c === "medium") return `по ${count} ${word}`;
  return `по ${count} ${word} — стабильно`;
}

function tagRow(p: MoodPattern, emoji: string, label: string): Row {
  const dir = p.delta >= 0 ? "выше" : "ниже";
  return {
    key: `tag:${p.key}`,
    emoji,
    insight: `В дни с тегом «${label}» настроение в среднем ${dir} на ${Math.abs(p.delta).toFixed(1)}`,
    delta: p.delta,
    count: p.count,
    confidence: p.confidence,
  };
}

function weekdayRow(p: MoodPattern): Row {
  const dir = p.delta >= 0 ? "выше" : "ниже";
  const form = WEEKDAY_DATIVE_PLURAL[p.key] ?? p.key.toLowerCase();
  return {
    key: `weekday:${p.key}`,
    emoji: "📅",
    insight: `По ${form} у тебя обычно ${dir} настроение`,
    delta: p.delta,
    count: p.count,
    confidence: p.confidence,
  };
}

function keywordRow(p: MoodPattern): Row {
  const dir = p.delta >= 0 ? "выше" : "ниже";
  return {
    key: `word:${p.key}`,
    emoji: "💬",
    insight: `Слово «${p.key}» чаще встречается в дни с настроением ${dir}`,
    delta: p.delta,
    count: p.count,
    confidence: p.confidence,
  };
}

export default function PatternsScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [loading, setLoading] = useState(true);
  const [totalEntries, setTotalEntries] = useState(0);
  const [tagRows, setTagRows] = useState<Row[]>([]);
  const [weekdayRows, setWeekdayRows] = useState<Row[]>([]);
  const [keywordRows, setKeywordRows] = useState<Row[]>([]);

  useFocusEffect(
    useCallback(() => {
      amplitude.track("patterns_viewed");
      let cancelled = false;
      (async () => {
        const [entries, tags] = await Promise.all([getAllDays(), getTags()]);
        if (cancelled) return;
        const allTags = [...tags.places, ...tags.activities];

        const tagPatterns = computeMoodPatterns(entries)
          .map((p) => {
            const tag = allTags.find((t) => t.id === p.key);
            return tag ? tagRow(p, tag.emoji, tag.label) : null;
          })
          .filter((r): r is Row => r !== null)
          .slice(0, MAX_SHOWN);

        const weekdayPatterns = computeWeekdayPatterns(entries).map(weekdayRow).slice(0, MAX_SHOWN);
        const keywordPatterns = computeKeywordPatterns(entries).map(keywordRow).slice(0, MAX_SHOWN);

        setTotalEntries(entries.length);
        setTagRows(tagPatterns);
        setWeekdayRows(weekdayPatterns);
        setKeywordRows(keywordPatterns);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [])
  );

  const allRows = [...tagRows, ...weekdayRows, ...keywordRows];
  const maxAbsDelta = Math.max(0.01, ...allRows.map((r) => Math.abs(r.delta)));
  const hasAnything = allRows.length > 0;

  function renderRow(r: Row) {
    const isPositive = r.delta >= 0;
    const barColor = isPositive ? "#31A876" : "#E68A78";
    const barWidthPct = (Math.abs(r.delta) / maxAbsDelta) * 100;
    return (
      <View key={r.key} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowEmoji}>{r.emoji}</Text>
          <Text style={[styles.rowInsight, { color: theme.foreground }]}>{r.insight}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.max(barWidthPct, 4)}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.rowMeta, { color: theme.mutedForeground }]}>
          {confidenceLabel(r.confidence, r.count)}
        </Text>
      </View>
    );
  }

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
      ) : !hasAnything ? (
        <View style={styles.centerWrap}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏷️</Text>
          <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Пока нет паттернов</Text>
          <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
            Добавляй теги и пиши ответы своими словами —{"\n"}
            как только что-то повторится хотя бы 3 раза,{"\n"}
            здесь появится, как это связано с твоим настроением.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          {tagRows.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Места и активности</Text>
              {tagRows.map(renderRow)}
            </>
          )}
          {weekdayRows.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Дни недели</Text>
              {weekdayRows.map(renderRow)}
            </>
          )}
          {keywordRows.length > 0 && (
            <>
              <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Слова в ответах</Text>
              {keywordRows.map(renderRow)}
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
  container: {
    padding: 20,
    gap: 12,
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
  rowMeta: { fontSize: 12 },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { fontSize: 14, lineHeight: 22, textAlign: "center" },
});
