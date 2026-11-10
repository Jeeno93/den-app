import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as amplitude from "@amplitude/analytics-react-native";
import colors from "@/constants/colors";
import {
  getPeriodReflection,
  getReflection,
  savePeriodReflection,
  saveReflection,
  type PeriodKind,
} from "@/src/storage/storage";

type Theme = typeof colors.dark;

export type ReflectionBlockKind = PeriodKind | "week";

const COPY: Record<
  ReflectionBlockKind,
  {
    title: string;
    impressionsLabel: string;
    impressionsPlaceholder: string;
    unexpectedLabel: string;
    unexpectedPlaceholder: string;
    focusLabel: string;
    started: string;
    completed: string;
    periodProp: string;
  }
> = {
  week: {
    title: "Твой взгляд на неделю",
    impressionsLabel: "Главные воспоминания и общие впечатления",
    impressionsPlaceholder: "Что запомнится из этой недели?",
    unexpectedLabel: "Что сложилось не так, как ожидалось",
    unexpectedPlaceholder: "Без самокритики — просто факты",
    focusLabel: "Фокус на следующую неделю",
    started: "weekly_reflection_started",
    completed: "weekly_reflection_completed",
    periodProp: "week_start",
  },
  month: {
    title: "Твой взгляд на месяц",
    impressionsLabel: "Главные впечатления месяца",
    impressionsPlaceholder: "Что запомнится из этого месяца?",
    unexpectedLabel: "Что сложилось не так, как ожидалось",
    unexpectedPlaceholder: "Без самокритики — просто факты",
    focusLabel: "Фокус на следующий месяц",
    started: "monthly_reflection_started",
    completed: "monthly_reflection_completed",
    periodProp: "month",
  },
  year: {
    title: "Твой взгляд на год",
    impressionsLabel: "Главное за год",
    impressionsPlaceholder: "Что ты вынесешь из этого года?",
    unexpectedLabel: "Что сложилось не так, как ожидалось",
    unexpectedPlaceholder: "Без самокритики — просто факты",
    focusLabel: "Фокус на следующий год",
    started: "yearly_reflection_started",
    completed: "yearly_reflection_completed",
    periodProp: "year",
  },
};

interface ReflectionBlockProps {
  kind: ReflectionBlockKind;
  /** week — понедельник "YYYY-MM-DD"; month — "YYYY-MM"; year — "YYYY". */
  period: string;
  theme: Theme;
}

/**
 * Свободная рефлексия за период: впечатления, что не сложилось, фокус.
 * Сохранение — по коммиту поля (идиома DayEntry). Воронка: started —
 * первое непустое поле, completed — заполнены «впечатления» и «фокус»
 * (середина опциональна), по одному разу за период.
 */
export function ReflectionBlock({ kind, period, theme }: ReflectionBlockProps) {
  const copy = COPY[kind];
  const [done, setDone] = useState("");
  const [problems, setProblems] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const reflection = kind === "week" ? await getReflection(period) : await getPeriodReflection(kind, period);
      if (cancelled) return;
      if (reflection) {
        setDone(reflection.done);
        setProblems(reflection.problems);
        setFocus(kind === "week" ? (reflection as any).nextWeekFocus : (reflection as any).nextFocus ?? "");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, period]);

  async function trackFunnel(next: { done: string; problems: string; focus: string }) {
    try {
      const props = { [copy.periodProp]: period };
      const hasContent = [next.done, next.problems, next.focus].some((v) => v.trim().length > 0);
      const startedKey = `reflection_started_${kind}_${period}`;
      if (hasContent && !(await AsyncStorage.getItem(startedKey))) {
        await AsyncStorage.setItem(startedKey, "1");
        amplitude.track(copy.started, props);
      }
      const coreDone = next.done.trim().length > 0 && next.focus.trim().length > 0;
      const completedKey = `reflection_completed_${kind}_${period}`;
      if (coreDone && !(await AsyncStorage.getItem(completedKey))) {
        await AsyncStorage.setItem(completedKey, "1");
        amplitude.track(copy.completed, props);
      }
    } catch {}
  }

  async function persist(next: { done: string; problems: string; focus: string }) {
    try {
      const now = new Date().toISOString();
      if (kind === "week") {
        const existing = await getReflection(period);
        await saveReflection({
          weekStart: period,
          done: next.done,
          wins: existing?.wins ?? [],
          problems: next.problems,
          nextWeekFocus: next.focus,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      } else {
        const existing = await getPeriodReflection(kind, period);
        await savePeriodReflection({
          kind,
          period,
          done: next.done,
          wins: existing?.wins ?? [],
          problems: next.problems,
          nextFocus: next.focus,
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
      }
      await trackFunnel(next);
    } catch {}
  }

  function commitField(field: "done" | "problems" | "focus", value: string) {
    const next = { done, problems, focus, [field]: value };
    if (field === "done") setDone(value);
    if (field === "problems") setProblems(value);
    if (field === "focus") setFocus(value);
    persist(next);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{copy.title}</Text>
      </View>

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>{copy.impressionsLabel}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.secondary, color: theme.foreground }]}
        value={done}
        onChangeText={setDone}
        onEndEditing={(e) => commitField("done", e.nativeEvent.text)}
        placeholder={copy.impressionsPlaceholder}
        placeholderTextColor={theme.mutedForeground}
        multiline
      />

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>{copy.unexpectedLabel}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.secondary, color: theme.foreground }]}
        value={problems}
        onChangeText={setProblems}
        onEndEditing={(e) => commitField("problems", e.nativeEvent.text)}
        placeholder={copy.unexpectedPlaceholder}
        placeholderTextColor={theme.mutedForeground}
        multiline
      />

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>{copy.focusLabel}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.secondary, color: theme.foreground }]}
        value={focus}
        onChangeText={setFocus}
        onEndEditing={(e) => commitField("focus", e.nativeEvent.text)}
        placeholder="Одно главное, что берёшь с собой"
        placeholderTextColor={theme.mutedForeground}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  streakChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  streakChipText: { fontSize: 12, fontWeight: "700" },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginTop: 6 },
  input: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, minHeight: 44 },
});
