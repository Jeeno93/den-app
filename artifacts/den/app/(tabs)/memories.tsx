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
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { formatDate, getAllDays, getDay, getStreak } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji } from "@/src/components/MoodPicker";

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function formatDateRu(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
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
  const [randomEntry, setRandomEntry] = useState<DayEntry | null>(null);
  const [allEntries, setAllEntries] = useState<DayEntry[]>([]);
  const [streak, setStreak] = useState({ current: 0, best: 0 });

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  async function loadData() {
    const now = new Date();
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    const yearAgoStr = formatDate(yearAgo);

    const [ya, all, streakData] = await Promise.all([
      getDay(yearAgoStr),
      getAllDays(),
      getStreak(),
    ]);

    setYearAgoEntry(ya);
    setAllEntries(all);
    setStreak(streakData);
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

      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.streakCard, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}>
          <View style={styles.streakRow}>
            <View style={styles.streakItem}>
              <Text style={[styles.streakNum, { color: theme.primary }]}>{streak.current}</Text>
              <Text style={[styles.streakLabel, { color: theme.mutedForeground }]}>Текущая серия</Text>
            </View>
            <View style={[styles.streakDivider, { backgroundColor: theme.border }]} />
            <View style={styles.streakItem}>
              <Text style={[styles.streakNum, { color: theme.primary }]}>{streak.best}</Text>
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
        </View>

        <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Год назад</Text>
        {yearAgoEntry ? (
          <MiniCard entry={yearAgoEntry} onPress={() => goToEntry(yearAgoEntry)} />
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
              <MiniCard entry={randomEntry} onPress={() => goToEntry(randomEntry)} />
            )}
          </>
        )}
      </ScrollView>
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
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    marginBottom: 8,
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
    fontSize: 40,
    fontWeight: "800",
    letterSpacing: -1,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 8,
  },
  miniCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
});
