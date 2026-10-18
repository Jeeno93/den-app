import React, { useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";

const ACCENT = "#5EE6A8";

/**
 * Поле «добавить свой вариант» прямо в анкете: новое место или занятие
 * появляется в тот день, когда оно случилось, а не после похода в настройки.
 */
export function InlineAddInput({
  placeholder,
  onAdd,
  onCancel,
}: {
  placeholder: string;
  onAdd: (label: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const [draft, setDraft] = useState("");

  async function submit() {
    const label = draft.trim();
    if (!label) {
      onCancel();
      return;
    }
    await onAdd(label);
    setDraft("");
  }

  return (
    <View style={styles.row}>
      <TextInput
        style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        placeholderTextColor={theme.mutedForeground}
        autoFocus
        maxLength={30}
        onSubmitEditing={submit}
        returnKeyType="done"
      />
      <TouchableOpacity style={[styles.button, { backgroundColor: ACCENT }]} onPress={submit} activeOpacity={0.8}>
        <Text style={styles.buttonText}>Добавить</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "center", marginTop: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  button: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  buttonText: { color: "#06080B", fontWeight: "700", fontSize: 13 },
});
