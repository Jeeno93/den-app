import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getDayQuestion, getRandomPositiveQuestion, getRandomNegativeQuestion } from "@/src/data/questions";
import { saveDay, getDay, getTags, getFillMode, saveFillMode, formatDate } from "@/src/storage/storage";
import type { DayAnswers, DayEntry, FillMode, SleepData, TaskItem, UserTags } from "@/src/storage/storage";
import { IntensityPicker } from "@/src/components/IntensityPicker";
import { INTENSITY_CONFIGS } from "@/src/data/intensity";
import type { IntensityValue } from "@/src/data/intensity";
import { MoodPicker } from "@/src/components/MoodPicker";
import { QuestionCard } from "@/src/components/QuestionCard";
import { NotesCard } from "@/src/components/NotesCard";
import { FillModeSwitcher } from "@/src/components/FillModeSwitcher";
import { DeepBlocks } from "@/src/components/DeepBlocks";

function makeEmptyTomorrowTasks(): TaskItem[] {
  return [
    { id: "t1", text: "", done: false },
    { id: "t2", text: "", done: false },
    { id: "t3", text: "", done: false },
  ];
}

const WEEK_DAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

type Phase = "mood" | "tags" | "questions" | "notes" | "deep" | "done";

const PHASE_ORDER: Record<FillMode, Phase[]> = {
  quick: ["mood", "tags"],
  standard: ["mood", "tags", "questions", "notes"],
  deep: ["mood", "tags", "questions", "notes", "deep"],
};

const QUESTION_INTENSITY_KEYS = ["learned", "met", "positive", "negative"] as const;

function makeInitialAnswers(): DayAnswers {
  return {
    learned: "",
    met: "",
    positive: { question: getRandomPositiveQuestion(), answer: "", category: "positive" },
    negative: { question: getRandomNegativeQuestion(), answer: "", category: "negative" },
    dayQuestion: "",
  };
}

interface DayFillFlowProps {
  date: string;
  topInset: number;
  /** Per-screen chrome rendered at the very top (nav header or back header). */
  header?: React.ReactNode;
  /** Show the date/day label in the body (today tab). */
  showDateLabel?: boolean;
  /** Called after a successful save, before the done screen is shown. */
  onSaved?: (entry: DayEntry) => void;
  /** Behaviour of the done-screen button. */
  doneVariant: "view" | "close";
  onView?: () => void;
  onClose?: () => void;
  /**
   * When provided, an in-flow back control is shown in the switcher row.
   * It steps back through phases (tags → mood) and calls `onExit` to leave
   * the flow from the first phase or the closing phases — replicating the
   * prior /day-fill back behaviour. Omit it (today tab) to keep the
   * date-navigation header as the only top control.
   */
  onExit?: () => void;
  /**
   * Incrementing nonce that asks the flow to switch to "deep" mode live
   * (used by the "try Глубоко" nudge). Ignored on the done screen.
   */
  applyDeepSignal?: number;
}

export function DayFillFlow({
  date,
  topInset,
  header,
  showDateLabel = false,
  onSaved,
  doneVariant,
  onView,
  onClose,
  onExit,
  applyDeepSignal,
}: DayFillFlowProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

  const parsedDate = new Date(date + "T12:00:00");
  const dayQuestion = getDayQuestion(parsedDate);

  const dateStr = `${parsedDate.getDate()} ${MONTHS_GEN[parsedDate.getMonth()]}`;
  const dayStr = WEEK_DAYS[parsedDate.getDay()];

  const [mode, setMode] = useState<FillMode>("standard");
  const [phase, setPhase] = useState<Phase>("mood");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<DayAnswers>(makeInitialAnswers());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [proud, setProud] = useState("");
  const [selectedPlaces, setSelectedPlaces] = useState<string[]>([]);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [loadedTags, setLoadedTags] = useState<UserTags | null>(null);

  const [intensities, setIntensities] = useState<{
    learned: IntensityValue;
    met: IntensityValue;
    positive: IntensityValue;
    negative: IntensityValue;
    proud: IntensityValue;
  }>({ learned: null, met: null, positive: null, negative: null, proud: null });

  // Deep-mode blocks
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState<SleepData>({ bedtime: "", wakeTime: "", quality: null });
  // Задачи: завтрашние (до 3, текстом) + вчерашние на сегодня (галочки).
  const [tomorrowTasks, setTomorrowTasks] = useState<TaskItem[]>(makeEmptyTomorrowTasks());
  const [reviewedTasks, setReviewedTasks] = useState<TaskItem[]>([]);

  // Переключатель режимов: по умолчанию свёрнут (режим уже выбран).
  const [switcherExpanded, setSwitcherExpanded] = useState(false);

  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    getTags().then(setLoadedTags);
    getFillMode().then(setMode);
  }, []);

  // Загружаем вчерашние задачи «на сегодня» (вчерашние tasksForTomorrow),
  // чтобы пользователь мог отметить их галочками сегодня вечером.
  useEffect(() => {
    const prev = new Date(date + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    getDay(formatDate(prev)).then((entry) => {
      const planned = entry?.tasksForTomorrow ?? [];
      const withText = planned.filter((t) => t.text.trim().length > 0);
      setReviewedTasks(withText.map((t) => ({ ...t, done: false })));
    });
  }, [date]);

  // Live-switch to "deep" when the nudge CTA fires. Edge-triggered: only a
  // *change* of the nonce switches mode, so a remount (e.g. key={date} change)
  // never re-forces deep over a mode the user picked afterwards. Skipped on the
  // done screen (the day is already saved — only the preference updates there).
  const lastDeepSignal = useRef(applyDeepSignal);
  useEffect(() => {
    if (applyDeepSignal === undefined || applyDeepSignal === lastDeepSignal.current) return;
    lastDeepSignal.current = applyDeepSignal;
    setMode("deep");
    saveFillMode("deep");
    setPhase((prev) => {
      if (prev === "done") return prev;
      const order = PHASE_ORDER.deep;
      return order.includes(prev) ? prev : order[order.length - 1];
    });
  }, [applyDeepSignal]);

  function setIntensity(key: keyof typeof intensities, v: IntensityValue) {
    setIntensities((prev) => ({ ...prev, [key]: v }));
  }

  // In-flow back (opt-in via onExit). Replicates prior /day-fill behaviour:
  // tags steps back to mood; every other phase exits the flow.
  function handleInFlowBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (phase === "tags") {
      setPhase("mood");
      return;
    }
    onExit?.();
  }

  function changeMode(next: FillMode) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(next);
    saveFillMode(next);
    setSwitcherExpanded(false); // после выбора сворачиваем обратно в строку
    // Clamp current phase to one that exists in the new mode's order.
    const order = PHASE_ORDER[next];
    if (!order.includes(phase)) {
      setPhase(order[order.length - 1]);
    }
  }

  const questionConfigs = [
    {
      getLabel: () => "Что сегодня узнал?",
      getValue: (a: DayAnswers) => a.learned,
      setValue: (a: DayAnswers, v: string): DayAnswers => ({ ...a, learned: v }),
    },
    {
      getLabel: () => "Кого встретил или вспомнил?",
      getValue: (a: DayAnswers) => a.met,
      setValue: (a: DayAnswers, v: string): DayAnswers => ({ ...a, met: v }),
    },
    {
      getLabel: (a: DayAnswers) => a.positive.question,
      getValue: (a: DayAnswers) => a.positive.answer,
      setValue: (a: DayAnswers, v: string): DayAnswers => ({ ...a, positive: { ...a.positive, answer: v } }),
    },
    {
      getLabel: (a: DayAnswers) => a.negative.question,
      getValue: (a: DayAnswers) => a.negative.answer,
      setValue: (a: DayAnswers, v: string): DayAnswers => ({ ...a, negative: { ...a.negative, answer: v } }),
    },
    {
      getLabel: () => dayQuestion,
      getValue: (a: DayAnswers) => a.dayQuestion,
      setValue: (a: DayAnswers, v: string): DayAnswers => ({ ...a, dayQuestion: v }),
    },
  ];

  function advanceFrom(current: Phase) {
    const order = PHASE_ORDER[mode];
    const idx = order.indexOf(current);
    if (idx < 0 || idx === order.length - 1) {
      handleDone();
    } else {
      setPhase(order[idx + 1]);
    }
  }

  function handleNextQuestion() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentQuestion < questionConfigs.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      advanceFrom("questions");
    }
  }

  async function handleDone() {
    if (!selectedMood || !date) {
      Alert.alert("Нельзя сохранить", "Не выбрано настроение или дата.");
      return;
    }

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (hapticErr) {
      console.warn("[DayFillFlow] haptics failed (non-fatal):", hapticErr);
    }

    const isDeep = mode === "deep";
    const entry: DayEntry = {
      date,
      mood: selectedMood,
      answers,
      question: dayQuestion,
      notes,
      photos,
      proud,
      learned_intensity: intensities.learned,
      met_intensity: intensities.met,
      positive_intensity: intensities.positive,
      negative_intensity: intensities.negative,
      proud_intensity: intensities.proud,
      places: selectedPlaces,
      activities: selectedActivities,
      fillMode: mode,
      energy: isDeep ? energy : null,
      sleep: isDeep ? sleep : null,
      tasksForTomorrow: isDeep ? tomorrowTasks.filter((t) => t.text.trim().length > 0) : [],
      tasksReviewed: isDeep ? reviewedTasks : [],
    };

    try {
      await saveDay(date, entry);
    } catch (err: any) {
      console.error("[DayFillFlow] saveDay failed:", err);
      const isQuota = String(err?.message ?? "").toLowerCase().includes("quota") ||
                      String(err?.message ?? "").toLowerCase().includes("storage");
      Alert.alert(
        "Не удалось сохранить день",
        isQuota
          ? "Слишком большой объём данных (вероятно, фото). Попробуйте удалить одно фото и сохранить снова."
          : String(err?.message ?? err)
      );
      return;
    }

    onSaved?.(entry);

    setPhase("done");
    doneOpacity.setValue(0);
    doneScale.setValue(0.5);
    Animated.parallel([
      Animated.timing(doneOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.sequence([
        Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 6 }),
        Animated.timing(doneScale, { toValue: 1.15, duration: 200, useNativeDriver: true }),
        Animated.timing(doneScale, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(doneScale, { toValue: 1.1, duration: 180, useNativeDriver: true }),
        Animated.timing(doneScale, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
    ]).start();
  }

  const isLastInputPhase = (() => {
    const order = PHASE_ORDER[mode];
    return order[order.length - 1] === phase;
  })();

  const bottomPad = Platform.OS === "web" ? 34 : 120;

  // --- Done screen ---
  if (phase === "done") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        {header}
        <View style={styles.doneContainer}>
          <Animated.View style={[styles.doneContent, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
            <View style={[styles.doneIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={[styles.doneTitle, { color: theme.foreground }]}>День записан.</Text>
            <Text style={[styles.doneSub, { color: theme.mutedForeground }]}>Увидимся завтра.</Text>
            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.secondary }]}
              onPress={() => (doneVariant === "view" ? onView?.() : onClose?.())}
            >
              <Text style={[styles.doneButtonText, { color: theme.foreground }]}>
                {doneVariant === "view" ? "Посмотреть запись" : "Закрыть"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </View>
    );
  }

  const dateLabel = showDateLabel ? (
    <>
      <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
      <Text style={[styles.dayText, { color: theme.mutedForeground }]}>{dayStr}</Text>
    </>
  ) : null;

  // --- Input phases (mood/tags/questions/notes/deep) share a header + sticky switcher ---
  function renderBody() {
    if (phase === "mood") {
      return (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          {dateLabel}
          <Text style={[styles.title, { color: theme.foreground }]}>Как настроение?</Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>Выбери одно из пяти</Text>
          <View style={styles.moodRow}>
            <MoodPicker
              selected={selectedMood}
              onSelect={(m) => setSelectedMood(m)}
            />
          </View>
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: selectedMood ? theme.primary : theme.muted }]}
            onPress={() => { if (selectedMood) advanceFrom("mood"); }}
            disabled={!selectedMood}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueText, { color: selectedMood ? theme.primaryForeground : theme.mutedForeground }]}>
              {isLastInputPhase ? "Готово" : "Продолжить"}
            </Text>
            <Ionicons
              name={isLastInputPhase ? "checkmark" : "arrow-forward"}
              size={18}
              color={selectedMood ? theme.primaryForeground : theme.mutedForeground}
            />
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (phase === "tags") {
      const togglePlace = (id: string) =>
        setSelectedPlaces((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      const toggleActivity = (id: string) =>
        setSelectedActivities((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
      return (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]} showsVerticalScrollIndicator={false}>
          {dateLabel}
          <Text style={[styles.title, { color: theme.foreground }]}>Где был и что делал?</Text>
          <Text style={[styles.sub, { color: theme.mutedForeground }]}>(необязательно)</Text>
          {loadedTags && (
            <>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>Места</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScrollRow}>
                {loadedTags.places.map((tag) => {
                  const selected = selectedPlaces.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.tagChip, { backgroundColor: selected ? "#3D9970" : theme.card, borderColor: selected ? "#3D9970" : theme.border }]}
                      onPress={() => togglePlace(tag.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.tagChipEmoji}>{tag.emoji}</Text>
                      <Text style={[styles.tagChipLabel, { color: selected ? "#fff" : theme.foreground }]}>{tag.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={[styles.sectionLabel, { color: theme.mutedForeground, marginTop: 12 }]}>Активности</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagsScrollRow}>
                {loadedTags.activities.map((tag) => {
                  const selected = selectedActivities.includes(tag.id);
                  return (
                    <TouchableOpacity
                      key={tag.id}
                      style={[styles.tagChip, { backgroundColor: selected ? "#3D9970" : theme.card, borderColor: selected ? "#3D9970" : theme.border }]}
                      onPress={() => toggleActivity(tag.id)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.tagChipEmoji}>{tag.emoji}</Text>
                      <Text style={[styles.tagChipLabel, { color: selected ? "#fff" : theme.foreground }]}>{tag.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: theme.primary, marginTop: 28 }]}
            onPress={() => { setCurrentQuestion(0); advanceFrom("tags"); }}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueText, { color: theme.primaryForeground }]}>
              {isLastInputPhase ? "Готово" : "Далее"}
            </Text>
            <Ionicons
              name={isLastInputPhase ? "checkmark" : "arrow-forward"}
              size={18}
              color={theme.primaryForeground}
            />
          </TouchableOpacity>
        </ScrollView>
      );
    }

    if (phase === "notes") {
      return (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {dateLabel}
            <NotesCard
              value={notes}
              onChange={setNotes}
              photos={photos}
              onPhotosChange={setPhotos}
              proud={proud}
              onProudChange={setProud}
              proudIntensity={intensities.proud}
              onProudIntensityChange={(v) => setIntensity("proud", v)}
              onDone={() => advanceFrom("notes")}
              isLast={isLastInputPhase}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    if (phase === "deep") {
      return (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "padding"}
        >
          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {dateLabel}
            <DeepBlocks
              energy={energy}
              onEnergyChange={setEnergy}
              sleep={sleep}
              onSleepChange={setSleep}
              reviewedTasks={reviewedTasks}
              onReviewedTasksChange={setReviewedTasks}
              tomorrowTasks={tomorrowTasks}
              onTomorrowTasksChange={setTomorrowTasks}
            />
            <TouchableOpacity
              style={[styles.continueButton, { backgroundColor: theme.primary, marginTop: 24 }]}
              onPress={() => advanceFrom("deep")}
              activeOpacity={0.85}
            >
              <Text style={[styles.continueText, { color: theme.primaryForeground }]}>Готово</Text>
              <Ionicons name="checkmark" size={18} color={theme.primaryForeground} />
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      );
    }

    // questions
    const qConfig = questionConfigs[currentQuestion];
    return (
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: bottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {dateLabel}
        <QuestionCard
          question={qConfig.getLabel(answers)}
          questionNumber={currentQuestion + 1}
          totalQuestions={questionConfigs.length}
          value={qConfig.getValue(answers)}
          onChange={(text) => setAnswers((prev) => qConfig.setValue(prev, text))}
          onNext={handleNextQuestion}
          onBack={currentQuestion > 0 ? () => setCurrentQuestion((q) => q - 1) : undefined}
          isLast={false}
        />
        {currentQuestion < QUESTION_INTENSITY_KEYS.length && qConfig.getValue(answers).trim().length > 0 && (
          <IntensityPicker
            config={INTENSITY_CONFIGS[QUESTION_INTENSITY_KEYS[currentQuestion]]}
            value={intensities[QUESTION_INTENSITY_KEYS[currentQuestion]]}
            onChange={(v) => setIntensity(QUESTION_INTENSITY_KEYS[currentQuestion], v)}
          />
        )}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      {header}
      <View style={[styles.switcherWrap, { paddingTop: header ? 4 : topInset + 8 }]}>
        <View style={styles.switcherRow}>
          {onExit && (
            <TouchableOpacity
              onPress={handleInFlowBack}
              style={styles.backChip}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color={theme.foreground} />
            </TouchableOpacity>
          )}
          <View style={styles.switcherFlex}>
            <FillModeSwitcher
              value={mode}
              onChange={changeMode}
              expanded={switcherExpanded}
              onExpand={() => setSwitcherExpanded(true)}
            />
          </View>
        </View>
      </View>
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switcherWrap: { paddingHorizontal: 20, paddingBottom: 8 },
  switcherRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  switcherFlex: { flex: 1 },
  backChip: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 12, gap: 4 },
  dateText: { fontSize: 24, fontWeight: "700", letterSpacing: -0.5 },
  dayText: { fontSize: 15, fontWeight: "400", marginTop: 2, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  sub: { fontSize: 15, marginBottom: 16 },
  moodRow: { marginTop: 12, marginBottom: 28 },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: { fontSize: 17, fontWeight: "600" },
  sectionLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  tagsScrollRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  tagChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 22, borderWidth: 1, gap: 5 },
  tagChipEmoji: { fontSize: 16 },
  tagChipLabel: { fontSize: 14, fontWeight: "500" },
  doneContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  doneContent: { alignItems: "center", gap: 16 },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  doneTitle: { fontSize: 28, fontWeight: "700", textAlign: "center", letterSpacing: -0.5 },
  doneSub: { fontSize: 18, textAlign: "center" },
  doneButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  doneButtonText: { fontSize: 16, fontWeight: "500" },
});
