import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { DayEntry as DayEntryType } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji, getMoodLabel } from "./MoodPicker";

const QUESTION_LABELS: Record<string, string> = {
  learned: "Что узнал сегодня?",
  met: "Кого встретил или вспомнил?",
  laughed: "Что рассмешило?",
  annoyed: "Что раздражало?",
  dayQuestion: "Вопрос дня",
};

interface DayEntryProps {
  entry: DayEntryType;
  dayQuestion?: string;
}

export function DayEntryView({ entry, dayQuestion }: DayEntryProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const moodColor = getMoodColor(entry.mood);

  const answerKeys: (keyof typeof entry.answers)[] = [
    "learned",
    "met",
    "laughed",
    "annoyed",
    "dayQuestion",
  ];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          styles.moodCard,
          { backgroundColor: moodColor + "22", borderColor: moodColor + "44" },
        ]}
      >
        <Text style={styles.moodEmoji}>{getMoodEmoji(entry.mood)}</Text>
        <View>
          <Text style={[styles.moodLabel, { color: moodColor }]}>
            {getMoodLabel(entry.mood)}
          </Text>
          <Text style={[styles.moodSub, { color: theme.mutedForeground }]}>
            Настроение за день
          </Text>
        </View>
      </View>

      {answerKeys.map((key) => {
        const label =
          key === "dayQuestion" && dayQuestion
            ? dayQuestion
            : QUESTION_LABELS[key];
        const answer = entry.answers[key];
        if (!answer) return null;
        return (
          <View
            key={key}
            style={[
              styles.answerCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: isDark ? "#000" : "#333",
              },
            ]}
          >
            <Text style={[styles.answerLabel, { color: theme.mutedForeground }]}>
              {label}
            </Text>
            <Text style={[styles.answerText, { color: theme.foreground }]}>
              {answer}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  moodCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  moodEmoji: {
    fontSize: 36,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  moodSub: {
    fontSize: 13,
    marginTop: 2,
  },
  answerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  answerLabel: {
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
  },
});
