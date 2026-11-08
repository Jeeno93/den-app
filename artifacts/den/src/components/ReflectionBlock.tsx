import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as amplitude from "@amplitude/analytics-react-native";
import { Ionicons } from "@expo/vector-icons";
import colors from "@/constants/colors";
import {
  getPeriodReflection,
  getReflection,
  getReflectionStreak,
  savePeriodReflection,
  saveReflection,
  type PeriodKind,
} from "@/src/storage/storage";
import { plural } from "@/src/utils/entryText";

type Theme = typeof colors.dark;

export type ReflectionBlockKind = PeriodKind | "week";

const MAX_WINS = 5;

const COPY: Record<
  ReflectionBlockKind,
  { title: string; focusLabel: string; started: string; completed: string; periodProp: string }
> = {
  week: {
    title: "Твой взгляд на неделю",
    focusLabel: "Фокус на следующую неделю",
    started: "weekly_reflection_started",
    completed: "weekly_reflection_completed",
    periodProp: "week_start",
  },
  month: {
    title: "Твой взгляд на месяц",
    focusLabel: "Фокус на следующий месяц",
    started: "monthly_reflection_started",
    completed: "monthly_reflection_completed",
    periodProp: "month",
  },
  year: {
    title: "Твой взгляд на год",
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
  /** Недельная серия показывается только у недельного блока. */
  showStreak?: boolean;
}

/**
 * Свободная рефлексия за период: что сделано, микроуспехи, что не пошло,
 * фокус на следующий период. Сохранение — по коммиту поля (идиома DayEntry).
 * Воронка: started — первое непустое наполнение, completed — заполнены
 * «сделано» и хотя бы один микроуспех (проблемы/фокус — опциональны),
 * по одному разу за период.
 */
export function ReflectionBlock({ kind, period, theme, showStreak }: ReflectionBlockProps) {
  const copy = COPY[kind];
  const [done, setDone] = useState("");
  const [wins, setWins] = useState<string[]>([]);
  const [problems, setProblems] = useState("");
  const [focus, setFocus] = useState("");
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [reflection, reflectionStreak] = await Promise.all([
        kind === "week"
          ? getReflection(period)
          : getPeriodReflection(kind, period),
        showStreak ? getReflectionStreak() : Promise.resolve(0),
      ]);
      if (cancelled) return;
      if (reflection) {
        setDone(reflection.done);
        setWins(reflection.wins);
        setProblems(reflection.problems);
        setFocus(kind === "week" ? (reflection as any).nextWeekFocus : (reflection as any).nextFocus ?? "");
      }
      setStreak(reflectionStreak);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, period]);

  async function trackFunnel(next: { done: string; wins: string[]; problems: string; focus: string }) {
    try {
      const props = { [copy.periodProp]: period };
      const hasCore = next.done.trim().length > 0 || next.wins.some((w) => w.trim().length > 0);
      const startedKey = `reflection_started_${kind}_${period}`;
      if (hasCore && !(await AsyncStorage.getItem(startedKey))) {
        await AsyncStorage.setItem(startedKey, "1");
        amplitude.track(copy.started, props);
      }
      const coreDone = next.done.trim().length > 0 && next.wins.some((w) => w.trim().length > 0);
      const completedKey = `reflection_completed_${kind}_${period}`;
      if (coreDone && !(await AsyncStorage.getItem(completedKey))) {
        await AsyncStorage.setItem(completedKey, "1");
        amplitude.track(copy.completed, props);
      }
    } catch {}
  }

  async function persist(next: { done: string; wins: string[]; problems: string; focus: string }) {
    try {
      const now = new Date().toISOString();
      if (kind === "week") {
        const existing = await getReflection(period);
        await saveReflection({
          weekStart: period,
          done: next.done,
          wins: next.wins,
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
          wins: next.wins,
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
    const next = { done, wins, problems, focus, [field]: value };
    if (field === "done") setDone(value);
    if (field === "problems") setProblems(value);
    if (field === "focus") setFocus(value);
    persist(next);
  }

  function commitWin(index: number, value: string) {
    const nextWins = wins.map((w, i) => (i === index ? value : w));
    setWins(nextWins);
    persist({ done, wins: nextWins, problems, focus });
  }

  function addWin() {
    if (wins.length >= MAX_WINS) return;
    const nextWins = [...wins, ""];
    setWins(nextWins);
    persist({ done, wins: nextWins, problems, focus });
  }

  function removeWin(index: number) {
    const nextWins = wins.filter((_, i) => i !== index);
    setWins(nextWins);
    persist({ done, wins: nextWins, problems, focus });
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, { color: theme.mutedForeground }]}>{copy.title}</Text>
        {showStreak && streak > 0 && (
          <View style={[styles.streakChip, { backgroundColor: theme.primary + "1A" }]}>
            <Text style={[styles.streakChipText, { color: theme.primary }]}>
              🔥 {streak} {plural(streak, ["неделя", "недели", "недель"])} подряд
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>Что было сделано</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.secondary, color: theme.foreground }]}
        value={done}
        onChangeText={setDone}
        onEndEditing={(e) => commitField("done", e.nativeEvent.text)}
        placeholder="Главные дела и события периода"
        placeholderTextColor={theme.mutedForeground}
        multiline
      />

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>Микроуспехи</Text>
      {wins.map((win, index) => (
        <View key={index} style={styles.winRow}>
          <TextInput
            style={[styles.winInput, { backgroundColor: theme.secondary, color: theme.foreground }]}
            value={win}
            onChangeText={(v) => setWins(wins.map((w, i) => (i === index ? v : w)))}
            onEndEditing={(e) => commitWin(index, e.nativeEvent.text)}
            placeholder={`Успех ${index + 1}`}
            placeholderTextColor={theme.mutedForeground}
          />
          <TouchableOpacity onPress={() => removeWin(index)} activeOpacity={0.7} style={styles.winRemove}>
            <Ionicons name="close-circle" size={20} color={theme.mutedForeground} />
          </TouchableOpacity>
        </View>
      ))}
      {wins.length < MAX_WINS && (
        <TouchableOpacity onPress={addWin} activeOpacity={0.7}>
          <Text style={[styles.addWin, { color: theme.primary }]}>+ Добавить успех</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.fieldLabel, { color: theme.mutedForeground }]}>Что не пошло</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.secondary, color: theme.foreground }]}
        value={problems}
        onChangeText={setProblems}
        onEndEditing={(e) => commitField("problems", e.nativeEvent.text)}
        placeholder="Что не получилось и почему"
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
  winRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  winInput: { flex: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  winRemove: { padding: 2 },
  addWin: { fontSize: 14, fontWeight: "600", marginTop: 2 },
});
