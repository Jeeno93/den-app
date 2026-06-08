import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getCustomQuestions, saveCustomQuestions } from "@/src/storage/storage";
import type { CustomQuestions } from "@/src/storage/storage";
import { getDayQuestion, DEFAULT_QUESTION_LABELS } from "@/src/data/questions";

const KEYS: (keyof CustomQuestions)[] = ["learned", "met", "positive", "negative", "dayQuestion"];

const SECTION_TITLES = [
  "Что узнал?",
  "Кого встретил?",
  "Позитивный момент",
  "Негативный момент",
  "Вопрос дня",
];

const EMPTY: CustomQuestions = {
  learned: null,
  met: null,
  positive: null,
  negative: null,
  dayQuestion: null,
};

export default function QuestionEditorScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [questions, setQuestions] = useState<CustomQuestions>(EMPTY);
  const [drafts, setDrafts] = useState<Record<keyof CustomQuestions, string>>({
    learned: "", met: "", positive: "", negative: "", dayQuestion: "",
  });

  const placeholders: string[] = [
    DEFAULT_QUESTION_LABELS[0],
    DEFAULT_QUESTION_LABELS[1],
    DEFAULT_QUESTION_LABELS[2],
    DEFAULT_QUESTION_LABELS[3],
    getDayQuestion(new Date()),
  ];

  useEffect(() => {
    getCustomQuestions().then((q) => {
      setQuestions(q);
      setDrafts({
        learned: q.learned ?? "",
        met: q.met ?? "",
        positive: q.positive ?? "",
        negative: q.negative ?? "",
        dayQuestion: q.dayQuestion ?? "",
      });
    });
  }, []);

  function handleDraftChange(key: keyof CustomQuestions, text: string) {
    setDrafts((prev) => ({ ...prev, [key]: text }));
  }

  async function handleBlur(key: keyof CustomQuestions) {
    const trimmed = drafts[key].trim();
    const updated: CustomQuestions = { ...questions, [key]: trimmed || null };
    setQuestions(updated);
    await saveCustomQuestions(updated);
  }

  async function resetQuestion(key: keyof CustomQuestions) {
    const updated: CustomQuestions = { ...questions, [key]: null };
    setQuestions(updated);
    setDrafts((prev) => ({ ...prev, [key]: "" }));
    await saveCustomQuestions(updated);
  }

  function handleResetAll() {
    Alert.alert(
      "Сбросить все вопросы?",
      "Все 5 вопросов вернутся к стандартным.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Сбросить",
          style: "destructive",
          onPress: async () => {
            setQuestions(EMPTY);
            setDrafts({ learned: "", met: "", positive: "", negative: "", dayQuestion: "" });
            await saveCustomQuestions(EMPTY);
          },
        },
      ]
    );
  }

  const fieldBg = isDark ? theme.muted : "#F8F9FA";
  const ACCENT = "#3D9970";

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[s.header, { paddingTop: topPad + 12, backgroundColor: theme.background, borderBottomColor: theme.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={24} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: theme.foreground }]}>Мои вопросы</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[s.body, { paddingBottom: Platform.OS === "web" ? 48 : 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[s.subtitle, { color: theme.mutedForeground }]}>
          Замените любой вопрос на свой. Оставьте поле пустым — вернётся стандартный.
        </Text>

        {KEYS.map((key, i) => {
          const isCustomized = !!(questions[key]?.trim());
          return (
            <View
              key={key}
              style={[
                s.card,
                {
                  backgroundColor: theme.card,
                  borderColor: isCustomized ? ACCENT : theme.border,
                },
              ]}
            >
              <View style={s.cardHeader}>
                <View style={s.cardLabelRow}>
                  <Text style={[s.cardNum, { color: isCustomized ? ACCENT : theme.mutedForeground }]}>
                    {i + 1}
                  </Text>
                  <Text style={[s.cardTitle, { color: theme.mutedForeground }]}>
                    {SECTION_TITLES[i]}
                  </Text>
                  {isCustomized && (
                    <View style={[s.badge, { backgroundColor: ACCENT + "20" }]}>
                      <Text style={[s.badgeText, { color: ACCENT }]}>изменён</Text>
                    </View>
                  )}
                </View>
                {isCustomized && (
                  <TouchableOpacity onPress={() => resetQuestion(key)} activeOpacity={0.7} hitSlop={8}>
                    <Ionicons name="close-circle" size={22} color={theme.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>

              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: fieldBg,
                    color: theme.foreground,
                    borderColor: isCustomized ? ACCENT + "50" : theme.border,
                  },
                ]}
                value={drafts[key]}
                onChangeText={(text) => handleDraftChange(key, text)}
                onBlur={() => handleBlur(key)}
                placeholder={placeholders[i]}
                placeholderTextColor={theme.mutedForeground}
                multiline
                maxLength={200}
              />
            </View>
          );
        })}

        <TouchableOpacity
          style={[s.resetAll, { borderColor: theme.border }]}
          onPress={handleResetAll}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={16} color={theme.mutedForeground} />
          <Text style={[s.resetAllText, { color: theme.mutedForeground }]}>
            Сбросить все к стандартным
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, alignItems: "flex-start" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "600", textAlign: "center" },
  body: { padding: 20, gap: 14 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 2 },
  card: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  cardNum: { fontSize: 13, fontWeight: "700", width: 16 },
  cardTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3 },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 52,
    textAlignVertical: "top",
  },
  resetAll: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resetAllText: { fontSize: 15 },
});
