import React, { useRef, useState } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { DayEntry as DayEntryType, DayAnswers } from "@/src/storage/storage";
import { saveDay } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji, getMoodLabel } from "./MoodPicker";

const QUESTION_LABELS: Record<keyof DayAnswers, string> = {
  learned: "Что узнал сегодня?",
  met: "Кого встретил или вспомнил?",
  laughed: "Что рассмешило?",
  annoyed: "Что раздражало?",
  dayQuestion: "Вопрос дня",
};

const ANSWER_KEYS: (keyof DayAnswers)[] = [
  "learned",
  "met",
  "laughed",
  "annoyed",
  "dayQuestion",
];

interface DayEntryProps {
  entry: DayEntryType;
  dayQuestion?: string;
}

export function DayEntryView({ entry, dayQuestion }: DayEntryProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const moodColor = getMoodColor(entry.mood);

  const [answers, setAnswers] = useState<DayAnswers>({ ...entry.answers });
  const [editingKey, setEditingKey] = useState<keyof DayAnswers | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const inputRef = useRef<TextInput>(null);

  function startEdit(key: keyof DayAnswers) {
    setDraftValue(answers[key]);
    setEditingKey(key);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraftValue("");
  }

  async function saveEdit() {
    if (editingKey === null) return;
    const updated: DayAnswers = { ...answers, [editingKey]: draftValue.trim() };
    setAnswers(updated);
    setEditingKey(null);
    setDraftValue("");
    await saveDay(entry.date, { ...entry, answers: updated });
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
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

      {ANSWER_KEYS.map((key) => {
        const label =
          key === "dayQuestion" && dayQuestion
            ? dayQuestion
            : QUESTION_LABELS[key];
        const answer = answers[key];
        const isEditing = editingKey === key;

        if (!answer && !isEditing) return null;

        if (isEditing) {
          return (
            <View
              key={key}
              style={[
                styles.answerCard,
                styles.editingCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.primary,
                  shadowColor: isDark ? "#000" : "#333",
                },
              ]}
            >
              <Text style={[styles.answerLabel, { color: theme.mutedForeground }]}>
                {label}
              </Text>

              <TextInput
                ref={inputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? theme.muted : "#F8F9FA",
                    color: theme.foreground,
                    borderColor: theme.border,
                  },
                ]}
                value={draftValue}
                onChangeText={setDraftValue}
                multiline
                textAlignVertical="top"
                placeholder="Напиши здесь..."
                placeholderTextColor={theme.mutedForeground}
              />

              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.muted, borderColor: theme.border }]}
                  onPress={cancelEdit}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.mutedForeground }]}>
                    Отмена
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={saveEdit}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={16} color={theme.primaryForeground} />
                  <Text style={[styles.saveButtonText, { color: theme.primaryForeground }]}>
                    Сохранить
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.answerCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: isDark ? "#000" : "#333",
              },
            ]}
            onPress={() => startEdit(key)}
            activeOpacity={0.75}
          >
            <View style={styles.answerHeader}>
              <Text style={[styles.answerLabel, { color: theme.mutedForeground, flex: 1 }]}>
                {label}
              </Text>
              <Ionicons name="pencil-outline" size={15} color={theme.mutedForeground} />
            </View>
            <Text style={[styles.answerText, { color: theme.foreground }]}>
              {answer}
            </Text>
          </TouchableOpacity>
        );
      })}

      {entry.notes ? (
        <View
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
            Заметки
          </Text>
          <Text style={[styles.answerText, { color: theme.foreground }]}>
            {entry.notes}
          </Text>
        </View>
      ) : null}

      {entry.photo ? (
        <View
          style={[
            styles.photoCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: isDark ? "#000" : "#333",
            },
          ]}
        >
          <Text style={[styles.answerLabel, { color: theme.mutedForeground, marginBottom: 8 }]}>
            Фото дня
          </Text>
          <Image
            source={{ uri: entry.photo }}
            style={styles.photoFull}
            resizeMode="cover"
          />
        </View>
      ) : null}
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
  editingCard: {
    borderWidth: 1.5,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 100,
    fontSize: 16,
    lineHeight: 24,
  },
  editButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  saveButton: {
    flex: 2,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  photoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  photoFull: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: 10,
  },
});
