import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { TagItem } from "@/src/data/defaultTags";
import { addCustomPerson, getPeople, togglePerson } from "@/src/data/people";
import { InlineAddInput } from "@/src/components/InlineAddInput";

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

  useEffect(() => {
    getPeople().then(setPeople);
  }, []);

  async function handleAdd(label: string) {
    const person = await addCustomPerson(label);
    setPeople(await getPeople());
    onChange(togglePerson(selected, person.id));
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
        <InlineAddInput
          placeholder="Например, одноклассники"
          onAdd={handleAdd}
          onCancel={() => setAdding(false)}
        />
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
});
