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
  computeMoodPatterns,
  computeWeekdayPatterns,
  computeKeywordPatterns,
  computeEngagementPatterns,
  computeMoodDistribution,
  computeTagFrequency,
} from "@/src/utils/moodPatterns";
import type { MoodPattern, Confidence } from "@/src/utils/moodPatterns";
import { MoodTrendChart, MoodDistributionDonut, TagFrequencyBars } from "@/src/components/PatternCharts";

// Минимум записей, при котором корреляции вообще имеют смысл показывать —
// как у Daylio: первые содержательные паттерны проявляются примерно к
// двум неделям ведения дневника, не раньше.
const MIN_ENTRIES = 10;
const MAX_SHOWN = 6;
const MAX_TAG_FREQ_SHOWN = 8;

// Дельта такого размера (или больше) рисуется "полным" баром. Шкала
// настроения 1-5, так что это не теоретический максимум (он был бы 4), а
// ориентир на реально заметный сдвиг — иначе почти все бары были бы у
// самого левого края и разница между ними была бы не видна.
const SCALE_REF_DELTA = 1.5;

interface Row {
  key: string;
  emoji: string;
  insight: string;
  share: string;
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

// Пресеты периода — как в аналитических дашбордах: без произвольного выбора
// дат, но с самыми ходовыми окнами. "Всё время" по умолчанию: паттернам
// нужен объём данных, и сужать окно по умолчанию значит показывать меньше
// того, ради чего экран существует.
const RANGE_PRESETS: { label: string; days: number | null }[] = [
  { label: "Неделя", days: 7 },
  { label: "Месяц", days: 30 },
  { label: "3 месяца", days: 90 },
  { label: "Всё время", days: null },
];

const ENGAGEMENT_INFO: Record<string, { emoji: string; phrase: string }> = {
  met: { emoji: "🤝", phrase: "со встречами или добрыми воспоминаниями о близких" },
  learned: { emoji: "💡", phrase: "с открытиями" },
};

function confidenceLabel(c: Confidence, count: number): string {
  const word = count === 1 ? "день" : count < 5 ? "дня" : "дней";
  if (c === "low") return `по ${count} ${word} — пока мало данных`;
  if (c === "medium") return `по ${count} ${word}`;
  return `по ${count} ${word} — стабильно`;
}

// Доля дней с оценкой 4-5 внутри группы против общей доли — устойчивее к
// дискретной шкале настроения, чем средняя дельта: если кто-то почти всегда
// ставит одну и ту же отметку, дельта еле шевелится, а доля "хороших" дней
// всё ещё осмысленно читается.
function shareLine(p: MoodPattern): string {
  const pct = Math.round(p.highShare * 100);
  const overallPct = Math.round((p.highShare - p.highShareDelta) * 100);
  return `${pct}% дней с оценкой 4-5 — против ${overallPct}% по всем твоим дням`;
}

function tagRow(p: MoodPattern, emoji: string, label: string): Row {
  const dir = p.delta >= 0 ? "выше" : "ниже";
  return {
    key: `tag:${p.key}`,
    emoji,
    insight: `В дни с тегом «${label}» настроение в среднем ${dir} на ${Math.abs(p.delta).toFixed(1)}`,
    share: shareLine(p),
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
    // Число здесь такое же обязательное, как в карточках тегов: без него
    // непонятно, "ниже" — это чуть-чуть или заметно.
    insight: `По ${form} настроение в среднем ${dir} на ${Math.abs(p.delta).toFixed(1)}`,
    share: shareLine(p),
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
    share: shareLine(p),
    delta: p.delta,
    count: p.count,
    confidence: p.confidence,
  };
}

function engagementRow(p: MoodPattern): Row | null {
  const info = ENGAGEMENT_INFO[p.key];
  if (!info) return null;
  const dir = p.delta >= 0 ? "выше" : "ниже";
  return {
    key: `eng:${p.key}`,
    emoji: info.emoji,
    insight: `В дни ${info.phrase} настроение в среднем ${dir} на ${Math.abs(p.delta).toFixed(1)}`,
    share: shareLine(p),
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

    const tagRows = computeMoodPatterns(entries)
      .map((p) => {
        const tag = tagLookup.get(p.key);
        return tag ? tagRow(p, tag.emoji, tag.label) : null;
      })
      .filter((r): r is Row => r !== null)
      .slice(0, MAX_SHOWN);

    const weekdayRows = computeWeekdayPatterns(entries).map(weekdayRow).slice(0, MAX_SHOWN);
    const keywordRows = computeKeywordPatterns(entries).map(keywordRow).slice(0, MAX_SHOWN);
    const engagementRows = computeEngagementPatterns(entries)
      .map(engagementRow)
      .filter((r): r is Row => r !== null);

    const tagFreqRows = computeTagFrequency(entries)
      .map((f) => {
        const tag = tagLookup.get(f.id);
        return tag ? { id: f.id, emoji: tag.emoji, label: tag.label, count: f.count } : null;
      })
      .filter((r): r is { id: string; emoji: string; label: string; count: number } => r !== null)
      .slice(0, MAX_TAG_FREQ_SHOWN);

    return {
      entries,
      totalEntries: entries.length,
      tagRows,
      weekdayRows,
      keywordRows,
      engagementRows,
      tagFreqRows,
      moodDistribution: computeMoodDistribution(entries),
    };
  }, [allDays, tagList, rangeDays]);

  const { entries, totalEntries, tagRows, weekdayRows, keywordRows, engagementRows, tagFreqRows, moodDistribution } = view;
  const allRows = [...tagRows, ...weekdayRows, ...engagementRows, ...keywordRows];
  const hasAnything = allRows.length > 0;

  function renderRow(r: Row) {
    const isPositive = r.delta >= 0;
    const barColor = isPositive ? "#31A876" : "#E68A78";
    const barWidthPct = Math.min(100, (Math.abs(r.delta) / SCALE_REF_DELTA) * 100);
    return (
      <View key={r.key} style={[styles.row, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <View style={styles.rowHeader}>
          <Text style={styles.rowEmoji}>{r.emoji}</Text>
          <Text style={[styles.rowInsight, { color: theme.foreground }]}>{r.insight}</Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.max(barWidthPct, 4)}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.rowShare, { color: theme.mutedForeground }]}>{r.share}</Text>
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

          {/* Графики выше осмысленны и на недельном окне, а корреляциям нужен
              объём — поэтому порог закрывает только карточки, иначе пресет
              "Неделя" всегда упирался бы в заглушку. */}
          {totalEntries < MIN_ENTRIES ? (
            <View style={styles.centerWrap}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📊</Text>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Мало данных для паттернов</Text>
              <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
                В этом периоде {totalEntries} из {MIN_ENTRIES} записей.{"\n"}
                Выбери период подлиннее — или продолжай вести{"\n"}
                дневник, и связи проявятся сами.
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
            <>
              <Text style={[styles.explainer, { color: theme.mutedForeground }]}>
                Настроение оценивается от 1 до 5. Число в карточке — насколько средняя оценка
                таких дней отличается от твоей обычной, а полоска показывает силу этого
                отличия: чем длиннее, тем сильнее.
              </Text>
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
              {engagementRows.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Встречи и открытия</Text>
                  {engagementRows.map(renderRow)}
                </>
              )}
              {keywordRows.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Слова в ответах</Text>
                  {keywordRows.map(renderRow)}
                </>
              )}
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
  rangeRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 2,
  },
  rangePill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  rangePillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  explainer: {
    fontSize: 12.5,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 2,
  },
  rowShare: { fontSize: 12.5, fontWeight: "500" },
  rowMeta: { fontSize: 12 },
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
