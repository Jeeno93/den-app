import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

const MOODS = [
  { value: 1, emoji: "😞", label: "Плохо", color: "#7B8FA1" },
  { value: 2, emoji: "😐", label: "Нейтрально", color: "#A8B5C1" },
  { value: 3, emoji: "🙂", label: "Хорошо", color: "#90C8A8" },
  { value: 4, emoji: "😄", label: "Отлично", color: "#5BAD8F" },
  { value: 5, emoji: "🤩", label: "Супер", color: "#3D9970" },
];

interface MoodPickerProps {
  selected: number | null;
  onSelect: (mood: number) => void;
}

export function MoodPicker({ selected, onSelect }: MoodPickerProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  return (
    <View style={styles.container}>
      {MOODS.map((mood) => {
        const isSelected = selected === mood.value;
        return (
          <TouchableOpacity
            key={mood.value}
            style={[
              styles.moodButton,
              {
                backgroundColor: isSelected
                  ? mood.color + "22"
                  : theme.card,
                borderColor: isSelected ? mood.color : theme.border,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
            onPress={() => onSelect(mood.value)}
            activeOpacity={0.7}
            testID={`mood-${mood.value}`}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function getMoodColor(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.color ?? "#A8B5C1";
}

export function getMoodLabel(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.label ?? "";
}

export function getMoodEmoji(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.emoji ?? "";
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    gap: 8,
  },
  moodButton: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 64,
  },
  emoji: {
    fontSize: 28,
  },
});
