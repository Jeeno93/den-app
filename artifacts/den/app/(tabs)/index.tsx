import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getDayQuestion } from "@/src/data/questions";
import { formatDate, getDay, saveDay } from "@/src/storage/storage";
import type { DayEntry } from "@/src/storage/storage";
import { MoodPicker } from "@/src/components/MoodPicker";
import { QuestionCard } from "@/src/components/QuestionCard";
import { NotesCard } from "@/src/components/NotesCard";
import { DayEntryView } from "@/src/components/DayEntry";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const QUESTIONS = [
  { key: "learned" as const, label: "Что сегодня узнал?" },
  { key: "met" as const, label: "Кого встретил или вспомнил?" },
  { key: "laughed" as const, label: "Что рассмешило?" },
  { key: "annoyed" as const, label: "Что раздражало?" },
  { key: "dayQuestion" as const, label: "" },
];

type Phase = "mood" | "questions" | "notes" | "done" | "view";

export default function HomeScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();

  const today = formatDate(new Date());
  const todayDate = new Date();
  const dayQuestion = getDayQuestion(todayDate);

  const [phase, setPhase] = useState<Phase>("mood");
  const [existingEntry, setExistingEntry] = useState<DayEntry | null>(null);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({
    learned: "",
    met: "",
    laughed: "",
    annoyed: "",
    dayQuestion: "",
  });
  const [notes, setNotes] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.9)).current;

  useFocusEffect(
    useCallback(() => {
      loadToday();
    }, [])
  );

  async function loadToday() {
    const entry = await getDay(today);
    if (entry) {
      setExistingEntry(entry);
      setPhase("view");
    } else {
      setExistingEntry(null);
      setPhase("mood");
      setSelectedMood(null);
      setCurrentQuestion(0);
      setAnswers({ learned: "", met: "", laughed: "", annoyed: "", dayQuestion: "" });
      setNotes("");
      animateIn();
    }
  }

  function animateIn() {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 10 }),
    ]).start();
  }

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

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentQuestion < QUESTIONS.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      setPhase("notes");
    }
  }

  async function handleDone() {
    if (!selectedMood) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const entry: DayEntry = {
      date: today,
      mood: selectedMood,
      answers,
      question: dayQuestion,
      notes,
      photo: null,
    };
    await saveDay(today, entry);
    setExistingEntry(entry);
    setPhase("done");

    doneOpacity.setValue(0);
    doneScale.setValue(0.9);
    Animated.parallel([
      Animated.timing(doneOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, tension: 50, friction: 8 }),
    ]).start();
  }

  const weekDays = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
  const months = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
  const dateStr = `${todayDate.getDate()} ${months[todayDate.getMonth()]}`;
  const dayStr = weekDays[todayDate.getDay()];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  if (phase === "view" && existingEntry) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { paddingTop: topPad + 16, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
          <View>
            <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
            <Text style={[styles.dayText, { color: theme.mutedForeground }]}>{dayStr}</Text>
          </View>
          <View style={[styles.doneBadge, { backgroundColor: theme.primary + "22" }]}>
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
            <Text style={[styles.doneBadgeText, { color: theme.primary }]}>Записано</Text>
          </View>
        </View>
        <DayEntryView entry={existingEntry} dayQuestion={existingEntry.question || dayQuestion} />
      </View>
    );
  }

  if (phase === "done") {
    return (
      <View style={[styles.doneContainer, { backgroundColor: theme.background }]}>
        <Animated.View style={[styles.doneContent, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
          <View style={[styles.doneIcon, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={[styles.doneTitle, { color: theme.foreground }]}>
            День записан.
          </Text>
          <Text style={[styles.doneSub, { color: theme.mutedForeground }]}>
            Увидимся завтра.
          </Text>
          <TouchableOpacity
            style={[styles.viewButton, { backgroundColor: theme.secondary }]}
            onPress={() => setPhase("view")}
          >
            <Text style={[styles.viewButtonText, { color: theme.foreground }]}>Посмотреть запись</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  if (phase === "mood") {
    return (
      <Animated.View style={[styles.flex, { backgroundColor: theme.background, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <ScrollView
          contentContainerStyle={[styles.moodContainer, { paddingTop: topPad + 20, paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
          <Text style={[styles.dayText, { color: theme.mutedForeground, marginBottom: 32 }]}>{dayStr}</Text>

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
      </Animated.View>
    );
  }

  const questionLabels = [
    ...QUESTIONS.slice(0, 4).map((q) => q.label),
    dayQuestion,
  ];

  if (phase === "notes") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <ScrollView
          contentContainerStyle={[styles.questionContainer, { paddingTop: topPad + 20, paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
          <Text style={[styles.dayText, { color: theme.mutedForeground, marginBottom: 20 }]}>{dayStr}</Text>
          <NotesCard value={notes} onChange={setNotes} onDone={handleDone} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={[styles.questionContainer, { paddingTop: topPad + 20, paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.dateText, { color: theme.foreground }]}>{dateStr}</Text>
        <Text style={[styles.dayText, { color: theme.mutedForeground, marginBottom: 20 }]}>{dayStr}</Text>

        <QuestionCard
          question={questionLabels[currentQuestion]}
          questionNumber={currentQuestion + 1}
          totalQuestions={5}
          value={answers[QUESTIONS[currentQuestion].key]}
          onChange={(text) =>
            setAnswers((prev) => ({ ...prev, [QUESTIONS[currentQuestion].key]: text }))
          }
          onNext={handleNext}
          isLast={false}
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
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  dateText: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  dayText: {
    fontSize: 15,
    fontWeight: "400",
    marginTop: 2,
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  doneBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  moodContainer: {
    paddingHorizontal: 20,
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
    paddingHorizontal: 20,
    gap: 4,
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
    fontSize: 18,
    textAlign: "center",
  },
  viewButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
