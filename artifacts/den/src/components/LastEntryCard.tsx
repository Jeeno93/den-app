import * as amplitude from "@amplitude/analytics-react-native";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMoodEmoji } from "@/src/components/MoodPicker";
import { MaskView } from "@/src/components/MaskView";
import type { DayEntry } from "@/src/storage/storage";
import { entryQuoteForCard } from "@/src/utils/entryText";

interface ThemeColors {
  foreground: string;
  mutedForeground: string;
  card: string;
  border: string;
  primary: string;
}

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T12:00:00").getTime();
  const b = new Date(toIso + "T12:00:00").getTime();
  return Math.round((b - a) / 86400000);
}

function whenLabel(entryDate: string, todayStr: string): string {
  const diff = daysBetween(entryDate, todayStr);
  if (diff === 1) return "Вчера";
  if (diff === 2) return "Позавчера";
  if (diff >= 3 && diff <= 7) {
    const word = diff < 5 ? "дня" : "дней";
    return `${diff} ${word} назад`;
  }
  const d = new Date(entryDate + "T12:00:00");
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/**
 * Напоминание о прошлой записи на экране заполнения.
 *
 * Смысл — дать второму дню то, чего не было в первый. По данным на 2026-09-03
 * 59% пользователей пишут ровно одну запись и не возвращаются, и одна из
 * причин структурная: на второй день приложение показывает ровно то же, что и
 * в первый (паттерны заперты, воспоминаний нет, год в пикселях пуст). Эта
 * карточка — первое, что существует только потому, что вчера человек писал.
 */
export function LastEntryCard({
  entry,
  todayStr,
  theme,
  onPress,
}: {
  entry: DayEntry;
  todayStr: string;
  theme: ThemeColors;
  onPress: () => void;
}) {
  const quote = entryQuoteForCard(entry);
  const text = quote?.text ?? null;
  const daysSince = daysBetween(entry.date, todayStr);
  const hasText = text !== null;

  // Показ трекаем в самом компоненте, а не на экране: он монтируется ровно
  // тогда, когда карточка видна, и экран не нужно обвешивать условиями.
  // Без показа тапы не с чем сравнивать: «карточку не увидели» и «увидели и
  // прошли мимо» — разные диагнозы, а от них зависит, что чинить.
  useEffect(() => {
    amplitude.track("last_entry_card_shown", { days_since: daysSince, has_text: hasText });
  }, [entry.date, daysSince, hasText]);

  return (
    <TouchableOpacity
      onPress={() => {
        amplitude.track("last_entry_card_tapped", { days_since: daysSince, has_text: hasText });
        onPress();
      }}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{getMoodEmoji(entry.mood)}</Text>
        <Text style={[styles.when, { color: theme.mutedForeground }]}>
          {whenLabel(entry.date, todayStr)} в дневнике
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
      </View>
      {quote ? (
        <MaskView>
          <Text style={[styles.source, { color: theme.mutedForeground }]} numberOfLines={1}>
            {quote.source}
          </Text>
          <Text style={[styles.text, { color: theme.foreground }]} numberOfLines={2}>
            {quote.text}
          </Text>
        </MaskView>
      ) : (
        <Text style={[styles.text, { color: theme.mutedForeground }]} numberOfLines={1}>
          В тот день отмечено только настроение
        </Text>
      )}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  emoji: { fontSize: 16 },
  when: { fontSize: 13, fontWeight: "600", flex: 1 },
  text: { fontSize: 14, lineHeight: 20 },
  source: { fontSize: 12, marginBottom: 2 },
});
