import React, { useState } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { HabitItem, SleepData, TaskItem } from "@/src/storage/storage";

const ACCENT = "#3D9970";

export const DEFAULT_HABITS: HabitItem[] = [
  { id: "sport", label: "Спорт", done: false },
  { id: "reading", label: "Чтение", done: false },
  { id: "water", label: "Вода", done: false },
  { id: "meditation", label: "Медитация", done: false },
  { id: "walk", label: "Прогулка", done: false },
];

const ENERGY_LEVELS = [
  { value: 1, label: "Мало сил" },
  { value: 2, label: "Нормально" },
  { value: 3, label: "Полон сил" },
];

const QUALITY_LEVELS = [
  { value: 1, label: "Плохо" },
  { value: 2, label: "Нормально" },
  { value: 3, label: "Отлично" },
];

/** "23:30" → Date (сегодня с этим временем). Пусто/мусор → текущее время. */
function timeStringToDate(value: string): Date {
  const d = new Date();
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (m) {
    const h = Math.min(23, parseInt(m[1], 10));
    const min = Math.min(59, parseInt(m[2], 10));
    d.setHours(h, min, 0, 0);
  }
  return d;
}

function dateToTimeString(d: Date): string {
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/** Приводит ввод к «HH:MM» (веб-запасной вариант). Мусор → "". */
function normalizeTimeString(value: string): string {
  const m = /^(\d{1,2}):(\d{1,2})$/.exec(value.trim());
  if (!m) return "";
  const h = Math.min(23, parseInt(m[1], 10));
  const min = Math.min(59, parseInt(m[2], 10));
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

interface Props {
  energy: number | null;
  onEnergyChange: (v: number | null) => void;
  sleep: SleepData;
  onSleepChange: (s: SleepData) => void;
  /** Вчерашние задачи на сегодня — отмечаются галочками. */
  reviewedTasks: TaskItem[];
  onReviewedTasksChange: (t: TaskItem[]) => void;
  /** До 3 задач на завтра — текстовые поля. */
  tomorrowTasks: TaskItem[];
  onTomorrowTasksChange: (t: TaskItem[]) => void;
}

export function DeepBlocks({
  energy,
  onEnergyChange,
  sleep,
  onSleepChange,
  reviewedTasks,
  onReviewedTasksChange,
  tomorrowTasks,
  onTomorrowTasksChange,
}: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const fieldBg = isDark ? theme.muted : "#F8F9FA";

  const [picker, setPicker] = useState<null | "bedtime" | "wakeTime">(null);

  function toggleReviewed(id: string) {
    onReviewedTasksChange(reviewedTasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  }

  function setTomorrowText(id: string, text: string) {
    onTomorrowTasksChange(tomorrowTasks.map((t) => (t.id === id ? { ...t, text } : t)));
  }

  function renderLevelRow(
    levels: { value: number; label: string }[],
    current: number | null,
    onSelect: (v: number | null) => void,
    testPrefix: string,
  ) {
    return (
      <View style={styles.levelRow}>
        {levels.map((lvl) => {
          const selected = current === lvl.value;
          return (
            <TouchableOpacity
              key={lvl.value}
              style={[
                styles.levelButton,
                {
                  borderColor: selected ? ACCENT : theme.border,
                  backgroundColor: selected ? ACCENT : fieldBg,
                },
              ]}
              onPress={() => onSelect(selected ? null : lvl.value)}
              activeOpacity={0.8}
              testID={`${testPrefix}-${lvl.value}`}
            >
              <Text style={[styles.levelText, { color: selected ? "#fff" : theme.foreground }]}>
                {lvl.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  function renderTimeField(field: "bedtime" | "wakeTime", label: string, placeholder: string) {
    const value = sleep[field];
    // Веб не поддерживает нативный TimePicker — оставляем текстовый ввод.
    if (Platform.OS === "web") {
      return (
        <View style={styles.timeField}>
          <Text style={[styles.timeLabel, { color: theme.mutedForeground }]}>{label}</Text>
          <TextInput
            style={[styles.timeInput, { backgroundColor: fieldBg, color: theme.foreground, borderColor: theme.border }]}
            placeholder={placeholder}
            placeholderTextColor={theme.mutedForeground}
            value={value}
            onChangeText={(t) => onSleepChange({ ...sleep, [field]: t })}
            onBlur={() => onSleepChange({ ...sleep, [field]: normalizeTimeString(value) })}
            maxLength={5}
          />
        </View>
      );
    }
    return (
      <View style={styles.timeField}>
        <Text style={[styles.timeLabel, { color: theme.mutedForeground }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.timeInput, styles.timeButton, { backgroundColor: fieldBg, borderColor: theme.border }]}
          onPress={() => setPicker(field)}
          activeOpacity={0.8}
          testID={`sleep-${field}`}
        >
          <Text style={[styles.timeValue, { color: value ? theme.foreground : theme.mutedForeground }]}>
            {value || placeholder}
          </Text>
          <Ionicons name="time-outline" size={18} color={theme.mutedForeground} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {/* Энергия — 3 уровня */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Уровень энергии</Text>
        <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>Как ты себя чувствовал?</Text>
        {renderLevelRow(ENERGY_LEVELS, energy, onEnergyChange, "energy")}
      </View>

      {/* Сон */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Сон</Text>
        <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>Когда лёг и встал</Text>
        <View style={styles.timeRow}>
          {renderTimeField("bedtime", "Лёг", "23:30")}
          {renderTimeField("wakeTime", "Встал", "07:00")}
        </View>
        <Text style={[styles.timeLabel, { color: theme.mutedForeground, marginTop: 8 }]}>Качество</Text>
        {renderLevelRow(
          QUALITY_LEVELS,
          sleep.quality,
          (v) => onSleepChange({ ...sleep, quality: v }),
          "sleep-quality",
        )}
      </View>

      {picker && (
        <DateTimePicker
          mode="time"
          display="spinner"
          value={timeStringToDate(sleep[picker])}
          is24Hour
          onChange={(event, selected) => {
            const field = picker;
            setPicker(null);
            if (event.type === "set" && selected && field) {
              onSleepChange({ ...sleep, [field]: dateToTimeString(selected) });
            }
          }}
        />
      )}

      {/* Задачи дня */}
      <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Text style={[styles.cardTitle, { color: theme.foreground }]}>Задачи дня</Text>

        {reviewedTasks.length > 0 && (
          <>
            <Text style={[styles.cardSub, { color: theme.mutedForeground }]}>
              Что планировал на сегодня?
            </Text>
            <View style={styles.taskList}>
              {reviewedTasks.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.taskRow, { borderColor: theme.border, backgroundColor: fieldBg }]}
                  onPress={() => toggleReviewed(t.id)}
                  activeOpacity={0.75}
                  testID={`task-review-${t.id}`}
                >
                  <View
                    style={[
                      styles.checkbox,
                      { borderColor: t.done ? ACCENT : theme.border, backgroundColor: t.done ? ACCENT : "transparent" },
                    ]}
                  >
                    {t.done && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                  <Text style={[styles.taskLabel, { color: theme.foreground }]}>{t.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={[styles.cardSub, { color: theme.mutedForeground, marginTop: reviewedTasks.length > 0 ? 8 : 0 }]}>
          3 задачи на завтра
        </Text>
        <View style={styles.taskList}>
          {tomorrowTasks.map((t, idx) => (
            <View
              key={t.id}
              style={[styles.taskInputRow, { borderColor: theme.border, backgroundColor: fieldBg }]}
            >
              <Text style={[styles.taskIndex, { color: theme.mutedForeground }]}>{idx + 1}</Text>
              <TextInput
                style={[styles.taskInput, { color: theme.foreground }]}
                placeholder="Задача…"
                placeholderTextColor={theme.mutedForeground}
                value={t.text}
                onChangeText={(text) => setTomorrowText(t.id, text)}
                testID={`task-tomorrow-${idx}`}
              />
            </View>
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
  levelRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  levelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  levelText: { fontSize: 14, fontWeight: "600", textAlign: "center" },
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
  timeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timeValue: { fontSize: 16 },
  taskList: { gap: 8, marginTop: 4 },
  taskRow: {
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
  taskLabel: { fontSize: 16, fontWeight: "500", flexShrink: 1 },
  taskInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  taskIndex: { fontSize: 14, fontWeight: "700", width: 16, textAlign: "center" },
  taskInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
});
