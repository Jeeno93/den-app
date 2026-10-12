import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { TagItem } from "@/src/data/defaultTags";
import { addCustomPerson, getPeople, togglePerson } from "@/src/data/people";

const ACCENT = "#5EE6A8";

interface Props {
  selected: string[];
  onChange: (next: string[]) => void;
}

/** Кнопки «с кем был день» под вопросом о встречах; можно выбрать несколько. */
export function PeoplePicker({ selected, onChange }: Props) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const [people, setPeople] = useState<TagItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    getPeople().then(setPeople);
  }, []);

  async function handleAdd() {
    const label = draft.trim();
    if (!label) {
      setAdding(false);
      return;
    }
    const person = await addCustomPerson(label);
    setPeople(await getPeople());
    onChange(togglePerson(selected, person.id));
    setDraft("");
    setAdding(false);
  }

  const chipStyle = (on: boolean) => [
    styles.chip,
    {
      borderColor: on ? ACCENT : theme.border,
      backgroundColor: on ? ACCENT + "18" : isDark ? theme.muted : "#F8F9FA",
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: theme.mutedForeground }]}>С кем был день</Text>
      <View style={styles.chips}>
        {people.map((p) => {
          const on = selected.includes(p.id);
          return (
            <TouchableOpacity key={p.id} style={chipStyle(on)} onPress={() => onChange(togglePerson(selected, p.id))} activeOpacity={0.7}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={[styles.label, { color: on ? ACCENT : theme.mutedForeground }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
        {!adding && (
          <TouchableOpacity style={chipStyle(false)} onPress={() => setAdding(true)} activeOpacity={0.7}>
            <Text style={[styles.label, { color: theme.mutedForeground }]}>+ свой</Text>
          </TouchableOpacity>
        )}
      </View>
      {adding && (
        <View style={styles.addRow}>
          <TextInput
            style={[styles.input, { color: theme.foreground, borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Например, одноклассники"
            placeholderTextColor={theme.mutedForeground}
            autoFocus
            maxLength={30}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity style={[styles.addButton, { backgroundColor: ACCENT }]} onPress={handleAdd} activeOpacity={0.8}>
            <Text style={styles.addButtonText}>Добавить</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, marginTop: 4 },
  title: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  emoji: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: "500" },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  addButton: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  addButtonText: { color: "#06080B", fontWeight: "700", fontSize: 13 },
});
