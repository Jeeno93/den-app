import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import type { RenderItemParams } from "react-native-draggable-flatlist";
import { useTheme } from "@/src/context/ThemeContext";
import colors from "@/constants/colors";
import { getTags, saveTags } from "@/src/storage/storage";
import type { UserTags, TagItem } from "@/src/storage/storage";
import { EMOJI_PALETTE } from "@/src/data/defaultTags";

const MIN_TAGS = 3;

export default function TagEditorScreen() {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [tags, setTags] = useState<UserTags | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [addType, setAddType] = useState<"place" | "activity">("place");
  const [labelInput, setLabelInput] = useState("");
  const [chosenEmoji, setChosenEmoji] = useState(EMOJI_PALETTE[0]);

  useEffect(() => {
    getTags().then(setTags);
  }, []);

  async function handleDelete(type: "place" | "activity", id: string) {
    if (!tags) return;
    const list = type === "place" ? tags.places : tags.activities;
    if (list.length <= MIN_TAGS) {
      Alert.alert("Нельзя удалить", `Минимум ${MIN_TAGS} тега в каждом разделе.`);
      return;
    }
    const updated: UserTags = {
      places: type === "place" ? tags.places.filter((t) => t.id !== id) : tags.places,
      activities: type === "activity" ? tags.activities.filter((t) => t.id !== id) : tags.activities,
    };
    await saveTags(updated);
    setTags(updated);
  }

  function openAdd(type: "place" | "activity") {
    setAddType(type);
    setLabelInput("");
    setChosenEmoji(EMOJI_PALETTE[0]);
    setShowModal(true);
  }

  async function handleAdd() {
    const label = labelInput.trim();
    if (!label || !tags) return;
    const newTag: TagItem = {
      id: `custom_${Date.now()}`,
      label,
      emoji: chosenEmoji,
    };
    const updated: UserTags = {
      places: addType === "place" ? [...tags.places, newTag] : tags.places,
      activities: addType === "activity" ? [...tags.activities, newTag] : tags.activities,
    };
    await saveTags(updated);
    setTags(updated);
    setShowModal(false);
  }

  const renderPlaceItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TagItem>) => (
      <ScaleDecorator activeScale={1.03}>
        <View
          style={[
            styles.tagRow,
            { backgroundColor: isActive ? (isDark ? "#1e3a2e" : "#eafaf2") : theme.card },
          ]}
        >
          <TouchableOpacity
            onLongPress={drag}
            style={styles.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons name="reorder-three-outline" size={22} color={theme.mutedForeground} />
          </TouchableOpacity>
          <Text style={styles.tagEmoji}>{item.emoji}</Text>
          <Text style={[styles.tagLabel, { color: theme.foreground }]}>{item.label}</Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete("place", item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={tags && tags.places.length <= MIN_TAGS ? theme.border : "#FF453A"}
            />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    ),
    [tags, isDark, theme]
  );

  const renderActivityItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<TagItem>) => (
      <ScaleDecorator activeScale={1.03}>
        <View
          style={[
            styles.tagRow,
            { backgroundColor: isActive ? (isDark ? "#1e3a2e" : "#eafaf2") : theme.card },
          ]}
        >
          <TouchableOpacity
            onLongPress={drag}
            style={styles.dragHandle}
            hitSlop={{ top: 10, bottom: 10, left: 8, right: 8 }}
          >
            <Ionicons name="reorder-three-outline" size={22} color={theme.mutedForeground} />
          </TouchableOpacity>
          <Text style={styles.tagEmoji}>{item.emoji}</Text>
          <Text style={[styles.tagLabel, { color: theme.foreground }]}>{item.label}</Text>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => handleDelete("activity", item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={tags && tags.activities.length <= MIN_TAGS ? theme.border : "#FF453A"}
            />
          </TouchableOpacity>
        </View>
      </ScaleDecorator>
    ),
    [tags, isDark, theme]
  );

  if (!tags) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background, justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: theme.mutedForeground }}>Загрузка…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: theme.border, backgroundColor: theme.background }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={theme.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.foreground }]}>Места и активности</Text>
        <View style={{ width: 40 }} />
      </View>

      <NestableScrollContainer
        contentContainerStyle={[styles.container, { paddingBottom: Platform.OS === "web" ? 34 : 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Места ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>МЕСТА</Text>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <NestableDraggableFlatList
              data={tags.places}
              keyExtractor={(item) => item.id}
              renderItem={renderPlaceItem}
              onDragEnd={({ data }) => {
                const updated = { ...tags, places: data };
                setTags(updated);
                saveTags(updated);
              }}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
            />
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "40" }]}
            onPress={() => openAdd("place")}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.addBtnText, { color: theme.primary }]}>Добавить место</Text>
          </TouchableOpacity>
        </View>

        {/* ── Активности ── */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: theme.mutedForeground }]}>АКТИВНОСТИ</Text>
          <View style={[styles.card, { borderColor: theme.border }]}>
            <NestableDraggableFlatList
              data={tags.activities}
              keyExtractor={(item) => item.id}
              renderItem={renderActivityItem}
              onDragEnd={({ data }) => {
                const updated = { ...tags, activities: data };
                setTags(updated);
                saveTags(updated);
              }}
              ItemSeparatorComponent={() => (
                <View style={[styles.separator, { backgroundColor: theme.border }]} />
              )}
            />
          </View>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: theme.primary + "18", borderColor: theme.primary + "40" }]}
            onPress={() => openAdd("activity")}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
            <Text style={[styles.addBtnText, { color: theme.primary }]}>Добавить активность</Text>
          </TouchableOpacity>
        </View>
      </NestableScrollContainer>

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.modalTitle, { color: theme.foreground }]}>
              {addType === "place" ? "Новое место" : "Новая активность"}
            </Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: isDark ? theme.muted : "#F5F5F5", color: theme.foreground, borderColor: theme.border }]}
              placeholder="Название"
              placeholderTextColor={theme.mutedForeground}
              value={labelInput}
              onChangeText={setLabelInput}
              maxLength={30}
              autoFocus
            />

            <Text style={[styles.emojiLabel, { color: theme.mutedForeground }]}>Эмодзи</Text>
            <FlatList
              data={EMOJI_PALETTE}
              keyExtractor={(e) => e}
              numColumns={8}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.emojiCell,
                    item === chosenEmoji && { backgroundColor: theme.primary + "30", borderRadius: 8 },
                  ]}
                  onPress={() => setChosenEmoji(item)}
                >
                  <Text style={styles.emojiCellText}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: theme.muted }]}
                onPress={() => setShowModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: theme.mutedForeground }]}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: labelInput.trim() ? theme.primary : theme.muted }]}
                onPress={handleAdd}
                disabled={!labelInput.trim()}
              >
                <Text style={[styles.modalSaveText, { color: labelInput.trim() ? theme.primaryForeground : theme.mutedForeground }]}>
                  Добавить
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 17, fontWeight: "600" },
  container: { paddingHorizontal: 20, paddingTop: 20, gap: 8 },
  section: { gap: 8, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    paddingHorizontal: 4,
  },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  separator: { height: StyleSheet.hairlineWidth },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  dragHandle: { padding: 2 },
  tagEmoji: { fontSize: 20, width: 28, textAlign: "center" },
  tagLabel: { flex: 1, fontSize: 16, fontWeight: "500" },
  deleteBtn: { padding: 4 },
  addBtn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addBtnText: { fontSize: 15, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", textAlign: "center" },
  modalInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  emojiLabel: { fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  emojiCell: { flex: 1, alignItems: "center", justifyContent: "center", padding: 6 },
  emojiCellText: { fontSize: 22 },
  modalButtons: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalCancelBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  modalCancelText: { fontSize: 16, fontWeight: "500" },
  modalSaveBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  modalSaveText: { fontSize: 16, fontWeight: "600" },
});
