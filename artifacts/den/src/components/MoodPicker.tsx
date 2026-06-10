import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";

const MOODS = [
  { value: 1, emoji: "😞", label: "Плохо",      color: "#7B8FA1" },
  { value: 2, emoji: "😐", label: "Нейтрально", color: "#A8B5C1" },
  { value: 3, emoji: "🙂", label: "Хорошо",     color: "#90C8A8" },
  { value: 4, emoji: "😄", label: "Отлично",    color: "#5BAD8F" },
  { value: 5, emoji: "🤩", label: "Супер",      color: "#5EE6A8" },
];

interface MoodPickerProps {
  selected: number | null;
  onSelect: (mood: number) => void;
}

export function MoodPicker({ selected, onSelect }: MoodPickerProps) {
  return (
    <View style={styles.container}>
      {MOODS.map((mood) => {
        const isSelected = selected === mood.value;
        return (
          <TouchableOpacity
            key={mood.value}
            onPress={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
              onSelect(mood.value);
            }}
            activeOpacity={0.8}
            testID={`mood-${mood.value}`}
            style={[
              styles.outer,
              isSelected && {
                shadowColor: "#5EE6A8",
                shadowOpacity: 0.45,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 0 },
                elevation: 18,
                transform: [{ scale: 1.1 }],
              },
            ]}
          >
            <View
              style={[
                styles.circle,
                isSelected && styles.circleActive,
              ]}
            >
              <Text style={styles.emoji}>{mood.emoji}</Text>
            </View>
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
  outer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: 72,
  },
  circle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#11161D",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  circleActive: {
    borderColor: "#5EE6A8",
  },
  emoji: {
    fontSize: 32,
  },
});
