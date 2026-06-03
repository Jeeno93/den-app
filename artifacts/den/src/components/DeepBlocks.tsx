import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { HabitItem, SleepData } from "@/src/storage/storage";

const ACCENT = "#3D9970";

export const DEFAULT_HABITS: HabitItem[] = [
  { id: "sport", label: "Спорт", done: false },
  { id: "reading", label: "Чтение", done: false },
  { id: "water", label: "Вода", done: false },
  { id: "meditation", label: "Медитация", done: false },
  { id: "walk", label: "Прогулка", done: false },
];

const ENERGY_LABELS = ["Истощён", "Низкая", "Норма", "Бодрый", "Заряжен"];

interface Props {
  energy: number | null;
  onEnergyChange: (v: number | null) => void;
  sleep: SleepData;
  onSleepChange: (s: SleepData) => void;
  habits: HabitItem[];
  onHabitsChange: (h: HabitItem[]) => void;
}

export function DeepBlocks({
  energy,
  onEnergyChange,
  sleep,
  onSleepChange,
  habits,
  onHabitsChange,
}: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const fieldBg = isDark ? theme.muted : "#F8F9FA";

  function toggleHabit(id: string) {
    onHabitsChange(habits.map((h) => (h.id === id ? { ...h, done: !h.done } : h)));
  }

  return (
    <View style={styles.wrapper}>
      {/* Энергия (1-5) — реальный блок */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Уровень энергии</Text>
        <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>Как ты себя чувствовал?</Text>
        <View style={styles.scaleRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = energy === n;
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.scaleDot,
                  {
                    borderColor: selected ? ACCENT : theme.border,
                    backgroundColor: selected ? ACCENT : fieldBg,
                  },
                ]}
                onPress={() => onEnergyChange(selected ? null : n)}
                activeOpacity={0.8}
                testID={`energy-${n}`}
              >
                <Text style={[styles.scaleDotText, { color: selected ? "#fff" : theme.mutedForeground }]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {energy != null && (
          <Text style={[styles.scaleCaption, { color: ACCENT }]}>{ENERGY_LABELS[energy - 1]}</Text>
        )}
      </View>

      {/* Трекер сна — заглушка со структурой */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Сон</Text>
        <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>Когда лёг и встал</Text>
        <View style={styles.timeRow}>
          <View style={styles.timeField}>
            <Text style={[styles.timeLabel, { color: theme.mutedForeground }]}>Лёг</Text>
            <TextInput
              style={[styles.timeInput, { backgroundColor: fieldBg, color: theme.foreground, borderColor: theme.border }]}
              placeholder="23:30"
              placeholderTextColor={theme.mutedForeground}
              value={sleep.bedtime}
              onChangeText={(t) => onSleepChange({ ...sleep, bedtime: t })}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          <View style={styles.timeField}>
            <Text style={[styles.timeLabel, { color: theme.mutedForeground }]}>Встал</Text>
            <TextInput
              style={[styles.timeInput, { backgroundColor: fieldBg, color: theme.foreground, borderColor: theme.border }]}
              placeholder="07:00"
              placeholderTextColor={theme.mutedForeground}
              value={sleep.wakeTime}
              onChangeText={(t) => onSleepChange({ ...sleep, wakeTime: t })}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
        </View>
        <Text style={[styles.timeLabel, { color: theme.mutedForeground, marginTop: 4 }]}>Качество</Text>
        <View style={styles.scaleRow}>
          {[1, 2, 3, 4, 5].map((n) => {
            const selected = sleep.quality === n;
            return (
              <TouchableOpacity
                key={n}
                style={[
                  styles.scaleDot,
                  {
                    borderColor: selected ? ACCENT : theme.border,
                    backgroundColor: selected ? ACCENT : fieldBg,
                  },
                ]}
                onPress={() => onSleepChange({ ...sleep, quality: selected ? null : n })}
                activeOpacity={0.8}
                testID={`sleep-quality-${n}`}
              >
                <Text style={[styles.scaleDotText, { color: selected ? "#fff" : theme.mutedForeground }]}>
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Трекер привычек — заглушка со структурой */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Привычки</Text>
        <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>Что удалось сегодня?</Text>
        <View style={styles.habitList}>
          {habits.map((h) => (
            <TouchableOpacity
              key={h.id}
              style={[styles.habitRow, { borderColor: theme.border, backgroundColor: fieldBg }]}
              onPress={() => toggleHabit(h.id)}
              activeOpacity={0.75}
              testID={`habit-${h.id}`}
            >
              <View
                style={[
                  styles.checkbox,
                  { borderColor: h.done ? ACCENT : theme.border, backgroundColor: h.done ? ACCENT : "transparent" },
                ]}
              >
                {h.done && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={[styles.habitLabel, { color: theme.foreground }]}>{h.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 16 },
  card: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    gap: 10,
  },
  cardTitle: { fontSize: 18, fontWeight: "600" },
  cardSub: { fontSize: 13, marginTop: -4 },
  scaleRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  scaleDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scaleDotText: { fontSize: 16, fontWeight: "700" },
  scaleCaption: { fontSize: 13, fontWeight: "600", textAlign: "center", marginTop: 2 },
  timeRow: { flexDirection: "row", gap: 12 },
  timeField: { flex: 1, gap: 6 },
  timeLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  timeInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  habitList: { gap: 8, marginTop: 4 },
  habitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  habitLabel: { fontSize: 16, fontWeight: "500" },
});
