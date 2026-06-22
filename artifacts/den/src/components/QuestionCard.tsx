import React, { useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

interface QuestionCardProps {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  value: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack?: () => void;
  isLast: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  value,
  onChange,
  onNext,
  onBack,
  isLast,
}: QuestionCardProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.card}>
      <View style={styles.cardShine} />

      <View style={styles.header}>
        <Text style={[styles.counter, { color: theme.mutedForeground }]}>
          {questionNumber} / {totalQuestions}
        </Text>
        <View style={styles.dots}>
          {Array.from({ length: totalQuestions }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i < questionNumber ? theme.primary : theme.border,
                  width: i === questionNumber - 1 ? 16 : 6,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <Text style={[styles.question, { color: theme.foreground }]}>
        {question}
      </Text>

      <TextInput
        ref={inputRef}
        style={[
          styles.input,
          {
            backgroundColor: isDark ? theme.muted : "#F8F9FA",
            color: theme.foreground,
            borderColor: theme.border,
          },
        ]}
        placeholder="Напиши здесь..."
        placeholderTextColor={theme.mutedForeground}
        multiline
        value={value}
        onChangeText={onChange}
        autoFocus={false}
        textAlignVertical="top"
      />

      <View style={styles.buttonRow}>
        {onBack ? (
          <TouchableOpacity
            style={[
              styles.backButton,
              { borderColor: theme.border, backgroundColor: theme.muted },
            ]}
            onPress={onBack}
            activeOpacity={0.7}
            testID="back-button"
          >
            <Ionicons name="chevron-back" size={18} color={theme.mutedForeground} />
            <Text style={[styles.backButtonText, { color: theme.mutedForeground }]}>
              Назад
            </Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.nextButton, !onBack && styles.nextButtonFull]}
          onPress={onNext}
          activeOpacity={0.85}
          testID={isLast ? "done-button" : "next-button"}
        >
          <LinearGradient colors={["#1B6B4A", "#0D2B1A"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.nextButtonText}>
            {isLast ? "Готово" : "Далее"}
          </Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={18} color="#5EE6A8" />
          )}
          {isLast && (
            <Ionicons name="checkmark" size={18} color="#5EE6A8" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "#0D1117",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 16,
    gap: 20,
    overflow: "hidden",
  },
  cardShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    fontSize: 13,
    fontWeight: "500",
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  question: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 100,
    fontSize: 16,
    lineHeight: 24,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  backButton: {
    flex: 1,
    height: 64,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
  nextButton: {
    flex: 2,
    borderRadius: 28,
    paddingVertical: 16,
    backgroundColor: "#0D2B1A",
    borderWidth: 1,
    borderColor: "rgba(94,230,168,0.4)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(94,230,168,0.12)",
    alignSelf: "center",
    top: -60,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#5EE6A8",
  },
});
