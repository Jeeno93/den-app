import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { MoodIcon } from "@/src/components/MoodIcon";

const MOODS = [
  { value: 1, emoji: "😞", label: "Плохо",      color: "#E68A78" },
  { value: 2, emoji: "😐", label: "Нейтрально", color: "#74787D" },
  { value: 3, emoji: "🙂", label: "Хорошо",     color: "#5C8C76" },
  { value: 4, emoji: "😄", label: "Отлично",    color: "#31A876" },
  // 4 и 5 намеренно делят один цвет — их различает не цвет кольца, а свечение
  // (сильнее и с белым акцентом у 5), проверено дата-вижн валидатором:
  // раздельные цвета для этой пары physически не проходят порог CVD-различимости
  // при фиксированном фирменном мятном на верхней ступени.
  { value: 5, emoji: "🤩", label: "Супер",      color: "#31A876" },
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
                shadowOpacity: 0.5,
                shadowRadius: 20,
                shadowOffset: { width: 0, height: 0 },
                elevation: 18,
                transform: [{ scale: 1.12 }],
              },
            ]}
          >
            <LinearGradient
              colors={["#2A2E35", "#1A1D22"]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[
                styles.circle,
                isSelected && styles.circleActive,
              ]}
            >
              <MoodIcon mood={mood.value} color={mood.color} size={30} />
            </LinearGradient>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function getMoodColor(mood: number): string {
  return MOODS.find((m) => m.value === mood)?.color ?? "#74787D";
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
    maxWidth: 64,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  circleActive: {
    borderColor: "#5EE6A8",
  },
});
