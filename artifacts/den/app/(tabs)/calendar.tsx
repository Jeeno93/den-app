import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji } from "@/src/components/MoodPicker";

const WEEK_DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const now = new Date();
  const yearPart = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : "";
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}${yearPart}`;
}

const SEARCH_FIELDS: Array<{ key: string; label: string }> = [
  { key: "learned",     label: "Что узнал" },
  { key: "met",         label: "Кого встретил" },
  { key: "laughed",     label: "Что рассмешило" },
  { key: "annoyed",     label: "Что раздражало" },
  { key: "dayQuestion", label: "Вопрос дня" },
  { key: "notes",       label: "Заметки" },
  { key: "question",    label: "Вопрос дня" },
];

interface MatchSegment {
  text: string;
  bold: boolean;
}

function getSegments(text: string, query: string): MatchSegment[] {
  if (!query || !text) return [{ text, bold: false }];
  const lower = text.toLowerCase();
  const lq = query.toLowerCase();
  const idx = lower.indexOf(lq);
  if (idx === -1) return [{ text, bold: false }];

  const CONTEXT = 50;
  const start = Math.max(0, idx - CONTEXT);
  const end = Math.min(text.length, idx + query.length + CONTEXT);
  const snippet = text.slice(start, end);
  const matchStart = idx - start;
  const matchEnd = matchStart + query.length;

  const segments: MatchSegment[] = [];
  if (matchStart > 0) {
    segments.push({ text: (start > 0 ? "…" : "") + snippet.slice(0, matchStart), bold: false });
  }
  segments.push({ text: snippet.slice(matchStart, matchEnd), bold: true });
  if (matchEnd < snippet.length) {
    segments.push({ text: snippet.slice(matchEnd) + (end < text.length ? "…" : ""), bold: false });
  }
  return segments;
}

interface SearchResult {
  entry: DayEntry;
  fieldLabel: string;
  segments: MatchSegment[];
}

function buildSearchResults(entries: Record<string, DayEntry>, query: string): SearchResult[] {
  if (!query.trim()) return [];
  const lq = query.toLowerCase();
  const results: SearchResult[] = [];

  const sorted = Object.values(entries).sort((a, b) => b.date.localeCompare(a.date));

  for (const entry of sorted) {
    for (const { key, label } of SEARCH_FIELDS) {
      let text = "";
      if (key === "notes") {
        text = entry.notes ?? "";
      } else if (key === "question") {
        text = entry.question ?? "";
      } else {
        text = (entry.answers as unknown as Record<string, string>)[key] ?? "";
      }

      if (text && text.toLowerCase().includes(lq)) {
        results.push({
          entry,
          fieldLabel: label,
          segments: getSegments(text, query),
        });
        break;
      }
    }
  }
  return results;
}

function HighlightedText({ segments, style }: { segments: MatchSegment[]; style?: object }) {
  return (
    <Text style={style} numberOfLines={2}>
      {segments.map((seg, i) =>
        seg.bold
          ? <Text key={i} style={styles.boldMatch}>{seg.text}</Text>
          : <Text key={i}>{seg.text}</Text>
      )}
    </Text>
  );
}

export default function CalendarScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [entries, setEntries] = useState<Record<string, DayEntry>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const searchRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [])
  );

  async function loadEntries() {
    const all = await getAllDays();
    const map: Record<string, DayEntry> = {};
    for (const e of all) map[e.date] = e;
    setEntries(map);
  }

  const isSearching = searchQuery.trim().length > 0;

  const searchResults = useMemo(
    () => buildSearchResults(entries, searchQuery),
    [entries, searchQuery]
  );

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  }

  const today = formatDate(now);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rawFirst = new Date(year, month, 1).getDay();
  const firstDay = rawFirst === 0 ? 6 : rawFirst - 1;

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  function handleDayPress(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (entries[dateStr]) {
      router.push({ pathname: "/day-detail", params: { date: dateStr } });
    } else if (dateStr <= today) {
      router.push({ pathname: "/day-fill", params: { date: dateStr } });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      {/* Top header with month nav */}
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: theme.background }]}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} testID="prev-month">
          <Ionicons name="chevron-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.monthTitle, { color: theme.foreground }]}>
          {MONTHS[month]} {year}
        </Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} testID="next-month">
          <Ionicons name="chevron-forward" size={22} color={theme.foreground} />
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={[styles.searchRow, { borderColor: isSearching ? theme.primary : theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}>
        <Ionicons name="search-outline" size={18} color={isSearching ? theme.primary : theme.mutedForeground} />
        <TextInput
          ref={searchRef}
          style={[styles.searchInput, { color: theme.foreground }]}
          placeholder="Найти день..."
          placeholderTextColor={theme.mutedForeground}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && Platform.OS !== "ios" && (
          <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={theme.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>

      {isSearching ? (
        /* ── Search results ──────────────────────────────── */
        <ScrollView
          contentContainerStyle={[styles.resultsContainer, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {searchResults.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyIcon]}>🔍</Text>
              <Text style={[styles.emptyTitle, { color: theme.foreground }]}>Ничего не найдено</Text>
              <Text style={[styles.emptySub, { color: theme.mutedForeground }]}>
                Попробуй другое слово
              </Text>
            </View>
          ) : (
            <>
              <Text style={[styles.resultsCount, { color: theme.mutedForeground }]}>
                {searchResults.length} {searchResults.length === 1 ? "запись" : searchResults.length < 5 ? "записи" : "записей"}
              </Text>
              {searchResults.map((result) => {
                const moodColor = getMoodColor(result.entry.mood);
                return (
                  <TouchableOpacity
                    key={result.entry.date}
                    style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => router.push({ pathname: "/day-detail", params: { date: result.entry.date } })}
                    activeOpacity={0.75}
                  >
                    <View style={styles.resultTop}>
                      <View style={[styles.resultMoodBadge, { backgroundColor: moodColor + "22" }]}>
                        <Text style={styles.resultEmoji}>{getMoodEmoji(result.entry.mood)}</Text>
                      </View>
                      <View style={styles.resultMeta}>
                        <Text style={[styles.resultDate, { color: theme.foreground }]}>
                          {formatDateRu(result.entry.date)}
                        </Text>
                        <Text style={[styles.resultField, { color: theme.mutedForeground }]}>
                          {result.fieldLabel}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
                    </View>
                    <HighlightedText
                      segments={result.segments}
                      style={[styles.resultPreview, { color: theme.foreground }]}
                    />
                  </TouchableOpacity>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : (
        /* ── Calendar grid ───────────────────────────────── */
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.weekRow}>
            {WEEK_DAYS.map((d) => (
              <Text key={d} style={[styles.weekDay, { color: theme.mutedForeground }]}>{d}</Text>
            ))}
          </View>

          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (day === null) return <View key={di} style={styles.dayCell} />;
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const entry = entries[dateStr];
                const isToday = dateStr === today;
                const isPast = dateStr <= today;
                const isTappable = !!entry || isPast;

                const textColor = entry
                  ? "#ffffff"
                  : isToday
                  ? theme.primary
                  : isPast
                  ? theme.foreground
                  : theme.mutedForeground;

                return (
                  <TouchableOpacity
                    key={di}
                    style={styles.dayCell}
                    onPress={() => handleDayPress(day)}
                    disabled={!isTappable}
                    activeOpacity={isTappable ? 0.7 : 1}
                    testID={`day-${day}`}
                  >
                    <View
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: entry ? getMoodColor(entry.mood) : "transparent",
                          borderWidth: isToday ? 2 : 0,
                          borderColor: isToday ? theme.primary : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayNum,
                          {
                            color: textColor,
                            fontWeight: isToday || !!entry ? "700" : "400",
                          },
                        ]}
                      >
                        {day}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}

          <View style={[styles.legend, { borderTopColor: theme.border }]}>
            <Text style={[styles.legendTitle, { color: theme.mutedForeground }]}>Цвета настроения</Text>
            <View style={styles.legendRow}>
              {[
                { color: "#7B8FA1", label: "Плохо" },
                { color: "#A8B5C1", label: "Нейтр." },
                { color: "#90C8A8", label: "Хорошо" },
                { color: "#5BAD8F", label: "Отлично" },
                { color: "#3D9970", label: "Супер" },
              ].map((item) => (
                <View key={item.color} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.legendLabel, { color: theme.mutedForeground }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
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
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  navBtn: {
    padding: 8,
    borderRadius: 20,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  weekDay: {
    width: 44,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dayCell: {
    width: 44,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNum: {
    fontSize: 14,
  },
  legend: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    paddingHorizontal: 8,
    gap: 10,
  },
  legendTitle: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 12,
  },
  /* Search results */
  resultsContainer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    gap: 10,
  },
  resultsCount: {
    fontSize: 13,
    fontWeight: "500",
    paddingBottom: 2,
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  resultTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  resultMoodBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  resultEmoji: {
    fontSize: 22,
  },
  resultMeta: {
    flex: 1,
    gap: 2,
  },
  resultDate: {
    fontSize: 15,
    fontWeight: "600",
  },
  resultField: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    fontWeight: "500",
  },
  resultPreview: {
    fontSize: 15,
    lineHeight: 21,
  },
  boldMatch: {
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 60,
    gap: 10,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  emptySub: {
    fontSize: 15,
  },
});
