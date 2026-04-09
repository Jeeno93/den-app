import React, { useRef, useState } from "react";
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getDayQuestion } from "@/src/data/questions";
import { saveDay } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { MoodPicker } from "@/src/components/MoodPicker";
import { QuestionCard } from "@/src/components/QuestionCard";

const WEEK_DAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const QUESTIONS = [
  { key: "learned" as const, label: "Что сегодня узнал?" },
  { key: "met" as const, label: "Кого встретил или вспомнил?" },
  { key: "laughed" as const, label: "Что рассмешило?" },
  { key: "annoyed" as const, label: "Что раздражало?" },
  { key: "dayQuestion" as const, label: "" },
];

type Phase = "mood" | "questions" | "done";

export default function DayFillScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const { date } = useLocalSearchParams<{ date: string }>();

  const parsedDate = date ? new Date(date) : new Date();
  const dayQuestion = getDayQuestion(parsedDate);

  const dateStr = `${parsedDate.getDate()} ${MONTHS_GEN[parsedDate.getMonth()]}`;
  const dayStr = WEEK_DAYS[parsedDate.getDay()];
  const yearStr = parsedDate.getFullYear();
  const currentYear = new Date().getFullYear();
  const fullDateStr = yearStr !== currentYear
    ? `${dateStr} ${yearStr}`
    : dateStr;

  const [phase, setPhase] = useState<Phase>("mood");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({
    learned: "",
    met: "",
    laughed: "",
    annoyed: "",
    dayQuestion: "",
  });

  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.9)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  function handleMoodSelect(mood: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMood(mood);
  }

  function handleMoodContinue() {
    if (!selectedMood) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase("questions");
    setCurrentQuestion(0);
  }

  async function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      await handleDone();
    }
  }

  async function handleDone() {
    if (!selectedMood || !date) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entry: DayEntry = {
      date,
      mood: selectedMood,
      answers,
      question: dayQuestion,
      photo: null,
    };
    await saveDay(date, entry);
    setPhase("done");

    doneOpacity.setValue(0);
    doneScale.setValue(0.9);
    Animated.parallel([
      Animated.timing(doneOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }

  const questionLabels = [
    ...QUESTIONS.slice(0, 4).map((q) => q.label),
    dayQuestion,
  ];

  if (phase === "done") {
    return (
      <View style={[styles.doneContainer, { backgroundColor: theme.background }]}>
        <Animated.View style={[styles.doneContent, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
          <View style={[styles.doneIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={[styles.doneTitle, { color: theme.foreground }]}>День записан.</Text>
          <Text style={[styles.doneSub, { color: theme.mutedForeground }]}>
            {fullDateStr}, {dayStr}
          </Text>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.secondary }]}
            onPress={() => router.back()}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.foreground} />
            <Text style={[styles.backButtonText, { color: theme.foreground }]}>Вернуться в календарь</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (phase === "mood") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.headerDate, { color: theme.foreground }]}>
              {fullDateStr}
            </Text>
            <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>
              {dayStr}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={[styles.moodContainer, { paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.sectionTitle, { color: theme.foreground }]}>Как настроение?</Text>
          <Text style={[styles.sectionSub, { color: theme.mutedForeground }]}>Выбери одно из пяти</Text>

          <View style={styles.moodRow}>
            <MoodPicker selected={selectedMood} onSelect={handleMoodSelect} />
          </View>

          <TouchableOpacity
            style={[
              styles.continueButton,
              { backgroundColor: selectedMood ? theme.primary : theme.muted },
            ]}
            onPress={handleMoodContinue}
            disabled={!selectedMood}
            activeOpacity={0.85}
          >
            <Text style={[styles.continueText, { color: selectedMood ? theme.primaryForeground : theme.mutedForeground }]}>
              Продолжить
            </Text>
            <Ionicons name="arrow-forward" size={18} color={selectedMood ? theme.primaryForeground : theme.mutedForeground} />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerDate, { color: theme.foreground }]}>
            {fullDateStr}
          </Text>
          <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>
            {dayStr}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.questionContainer, { paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionCard
          question={questionLabels[currentQuestion]}
          questionNumber={currentQuestion + 1}
          totalQuestions={5}
          value={answers[QUESTIONS[currentQuestion].key]}
          onChange={(text) =>
            setAnswers((prev) => ({ ...prev, [QUESTIONS[currentQuestion].key]: text }))
          }
          onNext={handleNext}
          isLast={currentQuestion === QUESTIONS.length - 1}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerDate: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  headerDay: {
    fontSize: 13,
    marginTop: 1,
  },
  moodContainer: {
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 4,
  },
  sectionTitle: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  sectionSub: {
    fontSize: 15,
    marginBottom: 28,
  },
  moodRow: {
    marginBottom: 32,
  },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: {
    fontSize: 17,
    fontWeight: "600",
  },
  questionContainer: {
    padding: 20,
    paddingTop: 24,
  },
  doneContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  doneContent: {
    alignItems: "center",
    gap: 16,
  },
  doneIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  doneTitle: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
  },
  doneSub: {
    fontSize: 17,
    textAlign: "center",
  },
  backButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
