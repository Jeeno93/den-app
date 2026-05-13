import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { DayEntry } from "@/src/storage/storage";
import { getMoodEmoji, getMoodLabel, getMoodColor } from "@/src/components/MoodPicker";

const MONTHS = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота",
];

interface ShareCardProps {
  entry: DayEntry;
}

export function ShareCard({ entry }: ShareCardProps) {
  const d = new Date(entry.date + "T12:00:00");
  const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  const dayStr = WEEKDAYS[d.getDay()];
  const moodColor = getMoodColor(entry.mood);
  const moodEmoji = getMoodEmoji(entry.mood);
  const moodLabel = getMoodLabel(entry.mood);

  type Row = { label: string; text: string };
  const rows: Row[] = [];

  if (entry.answers.learned) rows.push({ label: "Узнал сегодня", text: entry.answers.learned });
  if (entry.answers.met) rows.push({ label: "Встретил / вспомнил", text: entry.answers.met });
  if (entry.answers.positive?.answer) rows.push({ label: entry.answers.positive.question, text: entry.answers.positive.answer });
  if (entry.answers.negative?.answer) rows.push({ label: entry.answers.negative.question, text: entry.answers.negative.answer });
  if (entry.answers.dayQuestion) rows.push({ label: "Вопрос дня", text: entry.answers.dayQuestion });
  if (entry.proud) rows.push({ label: "Горжусь", text: entry.proud });
  if (entry.notes) rows.push({ label: "Итог дня", text: entry.notes });

  return (
    <View style={[styles.card, { backgroundColor: "#ffffff" }]}>
      <View style={[styles.topBar, { backgroundColor: moodColor + "22" }]}>
        <Text style={[styles.appName, { color: moodColor }]}>Den</Text>
        <View>
          <Text style={styles.dateStr}>{dateStr}</Text>
          <Text style={styles.dayStr}>{dayStr}</Text>
        </View>
      </View>

      <View style={[styles.moodRow, { backgroundColor: moodColor + "15", borderColor: moodColor + "30" }]}>
        <Text style={styles.moodEmoji}>{moodEmoji}</Text>
        <Text style={[styles.moodLabel, { color: moodColor }]}>{moodLabel}</Text>
      </View>

      {rows.slice(0, 5).map((row, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowText} numberOfLines={3}>{row.text}</Text>
          {i < Math.min(rows.length, 5) - 1 && <View style={styles.divider} />}
        </View>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Den · вечерний дневник</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    paddingBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  dateStr: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "right",
  },
  dayStr: {
    fontSize: 12,
    color: "#888",
    textAlign: "right",
    marginTop: 1,
  },
  moodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodLabel: {
    fontSize: 17,
    fontWeight: "700",
  },
  row: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#999",
    marginBottom: 3,
  },
  rowText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#1a1a1a",
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginTop: 10,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    color: "#bbb",
    letterSpacing: 0.3,
  },
});
