import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getMoodEmoji } from "@/src/components/MoodPicker";
import { MaskView } from "@/src/components/MaskView";
import type { DayEntry } from "@/src/storage/storage";

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
 * Первая непустая содержательная строка записи. Порядок неслучайный: сначала
 * то, что человек написал своими словами и по своей воле (заметки, "горжусь"),
 * потом ответы на заданные вопросы — они бывают дежурными.
 */
function preview(entry: DayEntry): string | null {
  const candidates = [
    entry.notes,
    entry.proud,
    entry.answers?.positive?.answer,
    entry.answers?.learned,
    entry.answers?.met,
    entry.answers?.dayQuestion,
  ];
  for (const raw of candidates) {
    const text = raw?.trim();
    if (!text) continue;
    const firstLine = text.split("\n")[0]!.trim();
    if (!firstLine) continue;
    return firstLine.length > 90 ? firstLine.slice(0, 89).trimEnd() + "…" : firstLine;
  }
  return null;
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
  const text = preview(entry);
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
    >
      <View style={styles.header}>
        <Text style={styles.emoji}>{getMoodEmoji(entry.mood)}</Text>
        <Text style={[styles.when, { color: theme.mutedForeground }]}>
          {whenLabel(entry.date, todayStr)} ты писал
        </Text>
        <Ionicons name="chevron-forward" size={16} color={theme.mutedForeground} />
      </View>
      {text ? (
        <MaskView>
          <Text style={[styles.text, { color: theme.foreground }]} numberOfLines={2}>
            {text}
          </Text>
        </MaskView>
      ) : (
        <Text style={[styles.text, { color: theme.mutedForeground }]} numberOfLines={1}>
          Тогда ты отметил только настроение
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
});
