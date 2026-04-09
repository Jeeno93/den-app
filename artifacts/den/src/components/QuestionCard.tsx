import React, { useRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
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
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          shadowColor: isDark ? "#000" : "#333",
        },
      ]}
    >
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
          style={[
            styles.nextButton,
            { backgroundColor: theme.primary },
            !onBack && styles.nextButtonFull,
          ]}
          onPress={onNext}
          activeOpacity={0.85}
          testID={isLast ? "done-button" : "next-button"}
        >
          <Text style={[styles.nextButtonText, { color: theme.primaryForeground }]}>
            {isLast ? "Готово" : "Далее"}
          </Text>
          {!isLast && (
            <Ionicons name="arrow-forward" size={18} color={theme.primaryForeground} />
          )}
          {isLast && (
            <Ionicons name="checkmark" size={18} color={theme.primaryForeground} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    gap: 20,
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
    borderRadius: 14,
    paddingVertical: 14,
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
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextButtonFull: {
    flex: 1,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
