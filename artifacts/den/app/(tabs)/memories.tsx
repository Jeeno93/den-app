import * as amplitude from "@amplitude/analytics-react-native";
import React, { useCallback, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays, getDay, getStreak, getLetters } from "@/src/storage/storage";
import type { DayEntry, TimeCapsuleLetter } from "@/src/storage/storage";
import { getStreakBadge } from "@/src/data/streakBadges";
import { getMoodColor, getMoodEmoji } from "@/src/components/MoodPicker";
import { EmptyState } from "@/src/components/EmptyState";
import { getDayQuote } from "@/src/data/quotes";

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

function lettersWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "писем";
  if (mod10 === 1) return "письмо";
  if (mod10 >= 2 && mod10 <= 4) return "письма";
  return "писем";
}

function nextLetterHint(letters: TimeCapsuleLetter[]): string {
  const unopened = letters.filter((l) => !l.opened).sort((a, b) => a.openDate.localeCompare(b.openDate));
  if (unopened.length === 0) return "все прочитаны";
  const next = unopened[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(next.openDate + "T00:00:00");
  const days = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return days <= 0 ? "готово к прочтению" : `следующее через ${days} дн.`;
}

interface MiniCardProps {
  entry: DayEntry;
  onPress: () => void;
}

function MiniCard({ entry, onPress }: MiniCardProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const moodColor = getMoodColor(entry.mood);

  return (
    <TouchableOpacity
      style={[styles.miniCard, { backgroundColor: theme.card, borderColor: theme.border, shadowColor: isDark ? "#000" : "#333" }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.miniMoodBadge, { backgroundColor: moodColor + "22" }]}>
        <Text style={styles.miniMoodEmoji}>{getMoodEmoji(entry.mood)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.miniDate, { color: theme.mutedForeground }]}>{formatDateRu(entry.date)}</Text>
        {entry.answers.learned ? (
          <Text style={[styles.miniAnswer, { color: theme.foreground }]} numberOfLines={2}>
            {entry.answers.learned}
          </Text>
        ) : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
    </TouchableOpacity>
  );
}

export default function MemoriesScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const [yearAgoEntry, setYearAgoEntry] = useState<DayEntry | null>(null);
  const [weekAgoEntry, setWeekAgoEntry] = useState<DayEntry | null>(null);
  const [monthAgoEntry, setMonthAgoEntry] = useState<DayEntry | null>(null);
  const [randomEntry, setRandomEntry] = useState<DayEntry | null>(null);
  const [allEntries, setAllEntries] = useState<DayEntry[]>([]);
  const [streak, setStreak] = useState({ current: 0, best: 0 });
  const [letters, setLetters] = useState<TimeCapsuleLetter[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      amplitude.track("memories_viewed");
      loadData();
    }, [])
  );

  async function loadData() {
    const now = new Date();

    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = formatDate(yearAgo);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = formatDate(weekAgo);

    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    const monthAgoStr = formatDate(monthAgo);

    const [ya, wa, ma, all, streakData, lettersData] = await Promise.all([
      getDay(yearAgoStr),
      getDay(weekAgoStr),
      getDay(monthAgoStr),
      getAllDays(),
      getStreak(),
      getLetters(),
    ]);

    setYearAgoEntry(ya);
    setWeekAgoEntry(wa);
    setMonthAgoEntry(ma);
    setAllEntries(all);
    setStreak(streakData);
    setLetters(lettersData);
    // streak_milestone is tracked once, at the moment the streak is earned,
    // from DayFillFlow.handleDone — not here, to avoid re-firing on every
    // visit to this tab while the streak sits on a milestone value.
  }

  function handleSurprise() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (allEntries.length === 0) return;
    const idx = Math.floor(Math.random() * allEntries.length);
    setRandomEntry(allEntries[idx]);
  }

  function goToEntry(entry: DayEntry) {
    router.push({ pathname: "/day-detail", params: { date: entry.date } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: theme.background }]}>
        <Text style={[styles.title, { color: theme.foreground }]}>Воспоминания</Text>
      </View>

      {allEntries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState />
        </View>
      ) : (
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.streakCard, { borderColor: "rgba(94,230,168,0.15)" }]}>
          <LinearGradient
            colors={["#5EE6A8", "#9CFFCE"]}
            style={styles.streakFireCircle}
          >
            <Text style={{ fontSize: 28 }}>🔥</Text>
          </LinearGradient>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={styles.streakNum}>{streak.current}</Text>
              <Text style={[styles.streakLabel, { color: theme.mutedForeground }]}>Текущая серия</Text>
            </View>
            <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
            <View style={styles.streakItem}>
              <Text style={styles.streakNum}>{streak.best}</Text>
              <Text style={[styles.streakLabel, { color: theme.mutedForeground }]}>Рекорд</Text>
            </View>
          </View>
          <View style={styles.streakIcons}>
            {Array.from({ length: Math.min(streak.current, 14) }).map((_, i) => (
              <View key={i} style={[styles.streakDot, { backgroundColor: theme.primary }]} />
            ))}
            {streak.current > 14 && (
              <Text style={[styles.streakMore, { color: theme.primary }]}>+{streak.current - 14}</Text>
            )}
          </View>
          {(() => {
            const badge = getStreakBadge(streak.current);
            if (!badge) return null;
            return (
              <View style={[styles.badgePlaque, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
                <Text style={[styles.badgeLabel, { color: theme.primaryForeground }]}>{badge.label}</Text>
              </View>
            );
          })()}
        </View>

        <TouchableOpacity
          style={[styles.yearPixelsBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push("/year-pixels" as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.yearPixelsIcon, { backgroundColor: "#5EE6A818" }]}>
            <Text style={{ fontSize: 20 }}>🟩</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.yearPixelsTitle, { color: theme.foreground }]}>Год в пикселях</Text>
            <Text style={[styles.yearPixelsSub, { color: theme.mutedForeground }]}>Настроение за последний год</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.yearPixelsBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => router.push("/letters" as any)}
          activeOpacity={0.8}
        >
          <View style={[styles.yearPixelsIcon, { backgroundColor: "#5EE6A818" }]}>
            <Text style={{ fontSize: 20 }}>💌</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.yearPixelsTitle, { color: theme.foreground }]}>Письма себе</Text>
            <Text style={[styles.yearPixelsSub, { color: theme.mutedForeground }]}>
              {letters.length === 0
                ? "Напиши письмо себе в будущее"
                : `${letters.length} ${lettersWord(letters.length)} · ${nextLetterHint(letters)}`}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={theme.mutedForeground} />
        </TouchableOpacity>

        {/* Quote of the day */}
        {(() => {
          const q = getDayQuote(new Date());
          return (
            <View style={styles.quoteCard}>
              <Text style={[styles.quoteHeader, { color: theme.mutedForeground }]}>Мысль дня</Text>
              <Text style={[styles.quoteOpenMark, { color: theme.primary }]}>"</Text>
              <Text style={[styles.quoteText, { color: theme.foreground }]}>{q.text}</Text>
              <Text style={[styles.quoteAuthor, { color: theme.mutedForeground }]}>— {q.author}</Text>
            </View>
          );
        })()}

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Неделя назад</Text>
        {weekAgoEntry ? (
          <MiniCard entry={weekAgoEntry} onPress={() => { amplitude.track("memory_tapped", { type: "week" }); goToEntry(weekAgoEntry); }} />
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>7 дней назад записей не было.</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Месяц назад</Text>
        {monthAgoEntry ? (
          <MiniCard entry={monthAgoEntry} onPress={() => { amplitude.track("memory_tapped", { type: "month" }); goToEntry(monthAgoEntry); }} />
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>30 дней назад записей не было.</Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Год назад</Text>
        {yearAgoEntry ? (
          <MiniCard entry={yearAgoEntry} onPress={() => { amplitude.track("memory_tapped", { type: "year" }); goToEntry(yearAgoEntry); }} />
        ) : (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="time-outline" size={32} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              Год назад записей не было.{"\n"}Напиши сегодня.
            </Text>
          </View>
        )}

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Случайный день</Text>
        {allEntries.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="shuffle-outline" size={32} color={theme.mutedForeground} />
            <Text style={[styles.emptyText, { color: theme.mutedForeground }]}>
              Пока нет записей.{"\n"}Начни с сегодняшнего дня.
            </Text>
          </View>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.surpriseBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
              onPress={handleSurprise}
              activeOpacity={0.8}
              testID="surprise-button"
            >
              <Ionicons name="shuffle" size={20} color={theme.foreground} />
              <Text style={[styles.surpriseBtnText, { color: theme.foreground }]}>Удиви меня</Text>
            </TouchableOpacity>
            {randomEntry && (
              <MiniCard entry={randomEntry} onPress={() => { amplitude.track("memory_tapped", { type: "random" }); goToEntry(randomEntry); }} />
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
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  container: {
    paddingHorizontal: 20,
    gap: 12,
  },
  streakCard: {
    borderRadius: 36,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    marginBottom: 8,
    backgroundColor: "#0D1117",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  streakFireCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(94,230,168,0.3)",
    shadowColor: "#5EE6A8",
    shadowOpacity: 0.2,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    alignSelf: "center",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  streakDivider: {
    width: 1,
    height: 48,
  },
  streakNum: {
    fontSize: 64,
    fontWeight: "200",
    letterSpacing: -3,
    color: "#FFFFFF",
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  streakIcons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  streakDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  streakMore: {
    fontSize: 12,
    fontWeight: "700",
    alignSelf: "center",
  },
  badgePlaque: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeEmoji: {
    fontSize: 18,
  },
  badgeLabel: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  miniCard: {
    borderRadius: 32,
    borderWidth: 1,
    padding: 18,
    backgroundColor: "#0D1117",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 22,
    elevation: 14,
  },
  miniMoodBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  miniMoodEmoji: {
    fontSize: 22,
  },
  miniDate: {
    fontSize: 12,
    fontWeight: "500",
    marginBottom: 4,
  },
  miniAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
  },
  surpriseBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  surpriseBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
  yearPixelsBtn: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  yearPixelsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  yearPixelsTitle: { fontSize: 16, fontWeight: "600" },
  yearPixelsSub: { fontSize: 13, marginTop: 1 },
  quoteCard: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 24,
    backgroundColor: "rgba(255,255,255,0.03)",
    gap: 4,
  },
  quoteHeader: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  quoteOpenMark: {
    fontSize: 48,
    fontWeight: "800",
    lineHeight: 40,
    marginTop: -4,
    opacity: 0.5,
  },
  quoteText: {
    fontSize: 16,
    fontStyle: "italic",
    lineHeight: 24,
  },
  quoteAuthor: {
    fontSize: 13,
    marginTop: 6,
  },
});
