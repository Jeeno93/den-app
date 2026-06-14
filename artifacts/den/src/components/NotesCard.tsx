import React from "react";
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
import { IntensityPicker } from "@/src/components/IntensityPicker";
import { INTENSITY_CONFIGS } from "@/src/data/intensity";
import type { IntensityValue } from "@/src/data/intensity";
import { savePhoto, deletePhoto } from "@/src/utils/photoStorage";

const MAX_PHOTOS = 3;

interface NotesCardProps {
  value: string;
  onChange: (text: string) => void;
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  proud: string;
  onProudChange: (text: string) => void;
  proudIntensity: IntensityValue;
  onProudIntensityChange: (v: IntensityValue) => void;
  onDone: () => void;
  isLast: boolean;
}

export function NotesCard({ value, onChange, photos, onPhotosChange, proud, onProudChange, proudIntensity, onProudIntensityChange, onDone, isLast }: NotesCardProps) {
  const { isDark } = useTheme();
  const theme = isDark ? colors.dark : colors.light;

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
    });
    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const path = await savePhoto(result.assets[0].uri);
        onPhotosChange([...photos, path]);
      } catch (err: any) {
        console.error("[NotesCard] savePhoto (camera) failed:", err);
        Alert.alert("Не удалось сохранить фото", String(err?.message ?? err));
      }
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
    });
    if (!result.canceled && result.assets[0]?.uri) {
      try {
        const path = await savePhoto(result.assets[0].uri);
        onPhotosChange([...photos, path]);
      } catch (err: any) {
        console.error("[NotesCard] savePhoto (gallery) failed:", err);
        Alert.alert("Не удалось сохранить фото", String(err?.message ?? err));
      }
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

  function removePhoto(idx: number) {
    const removed = photos[idx];
    onPhotosChange(photos.filter((_, i) => i !== idx));
    if (removed) {
      deletePhoto(removed).catch((err) =>
        console.warn("[NotesCard] deletePhoto failed (non-fatal):", err)
      );
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardShine} />

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Чем сегодня горжусь?
          </Text>
          <Text style={[styles.optional, { color: theme.mutedForeground }]}>
            (необязательно)
          </Text>
        </View>
        <TextInput
          style={[
            styles.input,
            styles.inputShort,
            {
              backgroundColor: isDark ? theme.muted : "#F8F9FA",
              color: theme.foreground,
              borderColor: theme.border,
            },
          ]}
          placeholder="Любое достижение, большое или маленькое..."
          placeholderTextColor={theme.mutedForeground}
          multiline
          value={proud}
          onChangeText={onProudChange}
          textAlignVertical="top"
          autoFocus={false}
        />
        {!!proud && (
          <IntensityPicker
            config={INTENSITY_CONFIGS.proud}
            value={proudIntensity}
            onChange={onProudIntensityChange}
          />
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.foreground }]}>
            Как в целом прошел твой день?
          </Text>
          <Text style={[styles.optional, { color: theme.mutedForeground }]}>
            (необязательно)
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
          placeholder="Опишите свой день своими словами..."
          placeholderTextColor={theme.mutedForeground}
          multiline
          value={value}
          onChangeText={onChange}
          textAlignVertical="top"
          autoFocus={false}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.photoLabel, { color: theme.mutedForeground }]}>
          Фото дня
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((uri, idx) => (
            <View key={idx} style={styles.thumbnailWrapper}>
              <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: theme.foreground }]}
                onPress={() => removePhoto(idx)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={theme.background} />
              </TouchableOpacity>
            </View>
          ))}
          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity
              style={[styles.addPhotoBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}
              onPress={handleAddPhoto}
              activeOpacity={0.75}
            >
              <Ionicons name="camera-outline" size={22} color={theme.mutedForeground} />
              {photos.length === 0 && (
                <Text style={[styles.addPhotoText, { color: theme.mutedForeground }]}>Добавить</Text>
              )}
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      <TouchableOpacity
        style={styles.doneButton}
        onPress={onDone}
        activeOpacity={0.85}
        testID="notes-done-button"
      >
        <View style={styles.doneButtonGlow} />
        <Text style={styles.doneButtonText}>
          {isLast ? "Готово" : "Далее"}
        </Text>
        <Ionicons name={isLast ? "checkmark" : "arrow-forward"} size={18} color="#FFFFFF" />
      </TouchableOpacity>
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
  section: {
    gap: 10,
  },
  titleRow: {
    gap: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 26,
  },
  optional: {
    fontSize: 13,
    fontWeight: "400",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    minHeight: 100,
    fontSize: 16,
    lineHeight: 24,
  },
  inputShort: {
    minHeight: 72,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  photoRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addPhotoText: {
    fontSize: 11,
    fontWeight: "500",
  },
  thumbnailWrapper: {
    position: "relative",
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  deleteBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButton: {
    height: 64,
    borderRadius: 28,
    backgroundColor: "#0D2B1A",
    borderWidth: 1,
    borderColor: "rgba(94,230,168,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    overflow: "hidden",
  },
  doneButtonGlow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(94,230,168,0.12)",
    alignSelf: "center",
    top: -60,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
