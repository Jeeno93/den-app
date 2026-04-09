import React from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

interface NotesCardProps {
  value: string;
  onChange: (text: string) => void;
  onDone: () => void;
}

export function NotesCard({ value, onChange, onDone }: NotesCardProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

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
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.foreground }]}>
          Что ещё хочется сказать?
        </Text>
        <Text style={[styles.optional, { color: theme.mutedForeground }]}>
          необязательно
        </Text>
      </View>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: isDark ? theme.muted : "#F8F9FA",
            color: theme.foreground,
            borderColor: theme.border,
          },
        ]}
        placeholder="Свободные мысли, наблюдения, идеи..."
        placeholderTextColor={theme.mutedForeground}
        multiline
        value={value}
        onChangeText={onChange}
        textAlignVertical="top"
        autoFocus={false}
      />

      <TouchableOpacity
        style={[styles.doneButton, { backgroundColor: theme.primary }]}
        onPress={onDone}
        activeOpacity={0.85}
        testID="notes-done-button"
      >
        <Text style={[styles.doneButtonText, { color: theme.primaryForeground }]}>
          Готово
        </Text>
        <Ionicons name="checkmark" size={18} color={theme.primaryForeground} />
      </TouchableOpacity>
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
  titleRow: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
    lineHeight: 28,
  },
  optional: {
    fontSize: 13,
    fontWeight: "400",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 120,
    fontSize: 16,
    lineHeight: 24,
  },
  doneButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
