import React, { useRef, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import type { DayEntry as DayEntryType, DayAnswers } from "@/src/storage/storage";
import { saveDay } from "@/src/storage/storage";
import { getMoodColor, getMoodEmoji, getMoodLabel } from "./MoodPicker";
import { getDayQuote } from "@/src/data/quotes";

const MAX_PHOTOS = 3;

const QUESTION_LABELS: Record<keyof DayAnswers, string> = {
  learned: "Что узнал сегодня?",
  met: "Кого встретил или вспомнил?",
  laughed: "Что рассмешило?",
  annoyed: "Что раздражало?",
  dayQuestion: "Вопрос дня",
};

const ANSWER_KEYS: (keyof DayAnswers)[] = [
  "learned",
  "met",
  "laughed",
  "annoyed",
  "dayQuestion",
];

interface DayEntryProps {
  entry: DayEntryType;
  dayQuestion?: string;
}

export function DayEntryView({ entry, dayQuestion }: DayEntryProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const moodColor = getMoodColor(entry.mood);

  const [answers, setAnswers] = useState<DayAnswers>({ ...entry.answers });
  const [editingKey, setEditingKey] = useState<keyof DayAnswers | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const answerInputRef = useRef<TextInput>(null);

  const [notes, setNotes] = useState<string>(entry.notes ?? "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const notesInputRef = useRef<TextInput>(null);

  const [photos, setPhotos] = useState<string[]>(entry.photos ?? []);

  // ── Answer editing ───────────────────────────────────────────────────────
  function startEdit(key: keyof DayAnswers) {
    setDraftValue(answers[key]);
    setEditingKey(key);
    setTimeout(() => answerInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingKey(null);
    setDraftValue("");
  }

  async function saveEdit() {
    if (editingKey === null) return;
    const updated: DayAnswers = { ...answers, [editingKey]: draftValue.trim() };
    setAnswers(updated);
    setEditingKey(null);
    setDraftValue("");
    await saveDay(entry.date, { ...entry, answers: updated, notes, photos });
  }

  // ── Notes editing ────────────────────────────────────────────────────────
  function startEditNotes() {
    setNotesDraft(notes);
    setIsEditingNotes(true);
    setTimeout(() => notesInputRef.current?.focus(), 50);
  }

  function cancelEditNotes() {
    setIsEditingNotes(false);
    setNotesDraft("");
  }

  async function saveEditNotes() {
    const updated = notesDraft.trim();
    setNotes(updated);
    setIsEditingNotes(false);
    setNotesDraft("");
    await saveDay(entry.date, { ...entry, answers, notes: updated, photos });
  }

  // ── Photo editing ────────────────────────────────────────────────────────
  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Нет доступа", "Разрешите доступ к камере в настройках устройства.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const updated = [...photos, uri];
      setPhotos(updated);
      await saveDay(entry.date, { ...entry, answers, notes, photos: updated });
    }
  }

  async function pickFromGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Нет доступа", "Разрешите доступ к галерее в настройках устройства.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: false,
      quality: 0.7,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      const uri = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const updated = [...photos, uri];
      setPhotos(updated);
      await saveDay(entry.date, { ...entry, answers, notes, photos: updated });
    }
  }

  function handleAddPhoto() {
    if (photos.length >= MAX_PHOTOS) return;
    if (Platform.OS === "web") {
      pickFromGallery();
      return;
    }
    Alert.alert("Фото дня", "Выберите источник", [
      { text: "Камера", onPress: pickFromCamera },
      { text: "Галерея", onPress: pickFromGallery },
      { text: "Отмена", style: "cancel" },
    ]);
  }

  async function handleDeletePhoto(idx: number) {
    Alert.alert("Удалить фото", "Фото будет удалено из записи.", [
      {
        text: "Удалить",
        style: "destructive",
        onPress: async () => {
          const updated = photos.filter((_, i) => i !== idx);
          setPhotos(updated);
          await saveDay(entry.date, { ...entry, answers, notes, photos: updated });
        },
      },
      { text: "Отмена", style: "cancel" },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.background }}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Mood */}
      <View
        style={[
          styles.moodCard,
          { backgroundColor: moodColor + "22", borderColor: moodColor + "44" },
        ]}
      >
        <Text style={styles.moodEmoji}>{getMoodEmoji(entry.mood)}</Text>
        <View>
          <Text style={[styles.moodLabel, { color: moodColor }]}>
            {getMoodLabel(entry.mood)}
          </Text>
          <Text style={[styles.moodSub, { color: theme.mutedForeground }]}>
            Настроение за день
          </Text>
        </View>
      </View>

      {/* Answer cards */}
      {ANSWER_KEYS.map((key) => {
        const label =
          key === "dayQuestion" && dayQuestion
            ? dayQuestion
            : QUESTION_LABELS[key];
        const answer = answers[key];
        const isEditing = editingKey === key;

        if (!answer && !isEditing) return null;

        if (isEditing) {
          return (
            <View
              key={key}
              style={[
                styles.answerCard,
                styles.editingCard,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.primary,
                  shadowColor: isDark ? "#000" : "#333",
                },
              ]}
            >
              <Text style={[styles.answerLabel, { color: theme.mutedForeground }]}>
                {label}
              </Text>
              <TextInput
                ref={answerInputRef}
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? theme.muted : "#F8F9FA",
                    color: theme.foreground,
                    borderColor: theme.border,
                  },
                ]}
                value={draftValue}
                onChangeText={setDraftValue}
                multiline
                textAlignVertical="top"
                placeholder="Напиши здесь..."
                placeholderTextColor={theme.mutedForeground}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: theme.muted, borderColor: theme.border }]}
                  onPress={cancelEdit}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cancelButtonText, { color: theme.mutedForeground }]}>
                    Отмена
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: theme.primary }]}
                  onPress={saveEdit}
                  activeOpacity={0.85}
                >
                  <Ionicons name="checkmark" size={16} color={theme.primaryForeground} />
                  <Text style={[styles.saveButtonText, { color: theme.primaryForeground }]}>
                    Сохранить
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }

        return (
          <TouchableOpacity
            key={key}
            style={[
              styles.answerCard,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                shadowColor: isDark ? "#000" : "#333",
              },
            ]}
            onPress={() => startEdit(key)}
            activeOpacity={0.75}
          >
            <View style={styles.answerHeader}>
              <Text style={[styles.answerLabel, { color: theme.mutedForeground, flex: 1 }]}>
                {label}
              </Text>
              <Ionicons name="pencil-outline" size={15} color={theme.mutedForeground} />
            </View>
            <Text style={[styles.answerText, { color: theme.foreground }]}>
              {answer}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Proud */}
      {!!entry.proud && (
        <View
          style={[
            styles.answerCard,
            { backgroundColor: theme.primary + "12", borderColor: theme.primary + "30", shadowColor: isDark ? "#000" : "#333" },
          ]}
        >
          <Text style={[styles.answerLabel, { color: theme.primary }]}>Гордость дня</Text>
          <Text style={[styles.answerText, { color: theme.foreground }]}>{entry.proud}</Text>
        </View>
      )}

      {/* Notes */}
      {isEditingNotes ? (
        <View
          style={[
            styles.answerCard,
            styles.editingCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.primary,
              shadowColor: isDark ? "#000" : "#333",
            },
          ]}
        >
          <Text style={[styles.answerLabel, { color: theme.mutedForeground }]}>
            Итоги дня
          </Text>
          <TextInput
            ref={notesInputRef}
            style={[
              styles.input,
              {
                backgroundColor: isDark ? theme.muted : "#F8F9FA",
                color: theme.foreground,
                borderColor: theme.border,
                minHeight: 120,
              },
            ]}
            value={notesDraft}
            onChangeText={setNotesDraft}
            multiline
            textAlignVertical="top"
            placeholder="Свободные мысли, наблюдения, идеи..."
            placeholderTextColor={theme.mutedForeground}
          />
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: theme.muted, borderColor: theme.border }]}
              onPress={cancelEditNotes}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelButtonText, { color: theme.mutedForeground }]}>
                Отмена
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: theme.primary }]}
              onPress={saveEditNotes}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={16} color={theme.primaryForeground} />
              <Text style={[styles.saveButtonText, { color: theme.primaryForeground }]}>
                Сохранить
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : notes ? (
        <TouchableOpacity
          style={[
            styles.answerCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: isDark ? "#000" : "#333",
            },
          ]}
          onPress={startEditNotes}
          activeOpacity={0.75}
        >
          <View style={styles.answerHeader}>
            <Text style={[styles.answerLabel, { color: theme.mutedForeground, flex: 1 }]}>
              Итоги дня
            </Text>
            <Ionicons name="pencil-outline" size={15} color={theme.mutedForeground} />
          </View>
          <Text style={[styles.answerText, { color: theme.foreground }]}>
            {notes}
          </Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[
            styles.addNoteBtn,
            { borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" },
          ]}
          onPress={startEditNotes}
          activeOpacity={0.75}
        >
          <Ionicons name="create-outline" size={18} color={theme.mutedForeground} />
          <Text style={[styles.addBtnText, { color: theme.mutedForeground }]}>
            Добавить заметки
          </Text>
        </TouchableOpacity>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <View
          style={[
            styles.photoCard,
            {
              backgroundColor: theme.card,
              borderColor: theme.border,
              shadowColor: isDark ? "#000" : "#333",
            },
          ]}
        >
          <View style={styles.photoHeader}>
            <Text style={[styles.answerLabel, { color: theme.mutedForeground }]}>
              Фото дня
            </Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoScrollContent}>
            {photos.map((uri, idx) => (
              <View key={idx} style={styles.photoThumbWrapper}>
                <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                <TouchableOpacity
                  style={[styles.photoDeleteBtn, { backgroundColor: "rgba(0,0,0,0.55)" }]}
                  onPress={() => handleDeletePhoto(idx)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="trash-outline" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <TouchableOpacity
                style={[styles.photoAddBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}
                onPress={handleAddPhoto}
                activeOpacity={0.75}
              >
                <Ionicons name="add" size={24} color={theme.mutedForeground} />
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      )}

      {photos.length === 0 && (
        <TouchableOpacity
          style={[
            styles.addNoteBtn,
            { borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" },
          ]}
          onPress={handleAddPhoto}
          activeOpacity={0.75}
        >
          <Ionicons name="camera-outline" size={18} color={theme.mutedForeground} />
          <Text style={[styles.addBtnText, { color: theme.mutedForeground }]}>
            Добавить фото
          </Text>
        </TouchableOpacity>
      )}

      {/* Quote of the day */}
      {(() => {
        const q = getDayQuote(new Date(entry.date + "T12:00:00"));
        return (
          <View style={styles.quoteBlock}>
            <Text style={[styles.quoteText, { color: theme.mutedForeground }]}>
              «{q.text}»
            </Text>
            <Text style={[styles.quoteAuthor, { color: theme.mutedForeground }]}>
              — {q.author}
            </Text>
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 100,
    gap: 12,
  },
  moodCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  moodEmoji: {
    fontSize: 36,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  moodSub: {
    fontSize: 13,
    marginTop: 2,
  },
  answerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 8,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  editingCard: {
    borderWidth: 1.5,
  },
  answerHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  answerLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  answerText: {
    fontSize: 16,
    lineHeight: 24,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 80,
  },
  editButtons: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
  },
  cancelButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  saveButton: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  addNoteBtn: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  photoCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  photoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  photoScrollContent: {
    gap: 10,
    alignItems: "center",
  },
  photoThumbWrapper: {
    position: "relative",
  },
  photoThumb: {
    width: 120,
    height: 120,
    borderRadius: 12,
  },
  photoDeleteBtn: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAddBtn: {
    width: 80,
    height: 120,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: {
    flexDirection: "row",
    gap: 6,
  },
  photoActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  photoActionText: {
    fontSize: 13,
    fontWeight: "500",
  },
  quoteBlock: {
    marginTop: 16,
    paddingHorizontal: 8,
    paddingBottom: 8,
    gap: 6,
    alignItems: "center",
  },
  quoteText: {
    fontSize: 15,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.75,
  },
  quoteAuthor: {
    fontSize: 12,
    textAlign: "center",
    opacity: 0.5,
  },
});
