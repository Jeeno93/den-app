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
import { getDayQuestion, getRandomPositiveQuestion, getRandomNegativeQuestion } from "@/src/data/questions";
import { saveDay } from "@/src/storage/storage";
import type { DayAnswers, DayEntry } from "@/src/storage/storage";
import { MoodPicker } from "@/src/components/MoodPicker";
import { QuestionCard } from "@/src/components/QuestionCard";
import { NotesCard } from "@/src/components/NotesCard";

const WEEK_DAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

type Phase = "mood" | "questions" | "notes" | "done";

function makeInitialAnswers(): DayAnswers {
  return {
    learned: "",
    met: "",
    positive: { question: getRandomPositiveQuestion(), answer: "", category: "positive" },
    negative: { question: getRandomNegativeQuestion(), answer: "", category: "negative" },
    dayQuestion: "",
  };
}

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
  const fullDateStr = yearStr !== currentYear ? `${dateStr} ${yearStr}` : dateStr;

  const [phase, setPhase] = useState<Phase>("mood");
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<DayAnswers>(makeInitialAnswers());
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [proud, setProud] = useState("");

  const doneOpacity = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0.9)).current;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentQuestion < questionConfigs.length - 1) {
      setCurrentQuestion((q) => q + 1);
    } else {
      setPhase("notes");
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
      notes,
      photos,
      proud,
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

  if (phase === "done") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={styles.doneContainer}>
          <Animated.View style={[styles.doneContent, { opacity: doneOpacity, transform: [{ scale: doneScale }] }]}>
            <View style={[styles.doneIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={48} color="#fff" />
            </View>
            <Text style={[styles.doneTitle, { color: theme.foreground }]}>День записан.</Text>
            <Text style={[styles.doneSub, { color: theme.mutedForeground }]}>Увидимся завтра.</Text>
            <TouchableOpacity style={[styles.closeButton, { backgroundColor: theme.secondary }]} onPress={() => router.back()}>
              <Text style={[styles.closeButtonText, { color: theme.foreground }]}>Закрыть</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
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
            <Text style={[styles.headerDate, { color: theme.foreground }]}>{fullDateStr}</Text>
            <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>{dayStr}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.moodContainer, { paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.moodTitle, { color: theme.foreground }]}>Как настроение?</Text>
          <Text style={[styles.moodSub, { color: theme.mutedForeground }]}>Выбери одно из пяти</Text>
          <MoodPicker selected={selectedMood} onSelect={setSelectedMood} />
          <TouchableOpacity
            style={[styles.continueButton, { backgroundColor: selectedMood ? theme.primary : theme.muted, marginTop: 32 }]}
            onPress={() => { if (selectedMood) { setPhase("questions"); setCurrentQuestion(0); } }}
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

  if (phase === "notes") {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color={theme.foreground} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.headerDate, { color: theme.foreground }]}>{fullDateStr}</Text>
            <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>{dayStr}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView
          contentContainerStyle={[styles.questionContainer, { paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <NotesCard value={notes} onChange={setNotes} photos={photos} onPhotosChange={setPhotos} proud={proud} onProudChange={setProud} onDone={handleDone} />
        </ScrollView>
      </View>
    );
  }

  // Questions phase
  const qConfig = questionConfigs[currentQuestion];
  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.headerDate, { color: theme.foreground }]}>{fullDateStr}</Text>
          <Text style={[styles.headerDay, { color: theme.mutedForeground }]}>{dayStr}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.questionContainer, { paddingBottom: Platform.OS === "web" ? 34 : 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <QuestionCard
          question={qConfig.getLabel(answers)}
          questionNumber={currentQuestion + 1}
          totalQuestions={questionConfigs.length}
          value={qConfig.getValue(answers)}
          onChange={(text) => setAnswers((prev) => qConfig.setValue(prev, text))}
          onNext={handleNext}
          onBack={currentQuestion > 0 ? () => setCurrentQuestion((q) => q - 1) : undefined}
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
    paddingHorizontal: 12,
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
  headerDate: { fontSize: 16, fontWeight: "700" },
  headerDay: { fontSize: 12, marginTop: 1 },
  moodContainer: { paddingHorizontal: 20, paddingTop: 28, gap: 8 },
  moodTitle: { fontSize: 26, fontWeight: "700", letterSpacing: -0.5 },
  moodSub: { fontSize: 15, marginBottom: 20 },
  continueButton: {
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  continueText: { fontSize: 17, fontWeight: "600" },
  questionContainer: { paddingHorizontal: 20, paddingTop: 20, gap: 4 },
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
  closeButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
  },
  closeButtonText: { fontSize: 16, fontWeight: "500" },
});
