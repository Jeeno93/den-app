import React from "react";
import {
  Alert,
  Image,
  Platform,
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

interface NotesCardProps {
  value: string;
  onChange: (text: string) => void;
  photo: string | null;
  onPhotoChange: (photo: string | null) => void;
  onDone: () => void;
}

export function NotesCard({ value, onChange, photo, onPhotoChange, onDone }: NotesCardProps) {
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
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      onPhotoChange(`data:image/jpeg;base64,${result.assets[0].base64}`);
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
      onPhotoChange(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  }

  function handleAddPhoto() {
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

      <View style={styles.photoSection}>
        <Text style={[styles.photoLabel, { color: theme.mutedForeground }]}>
          Фото дня
        </Text>

        {photo ? (
          <View style={styles.thumbnailRow}>
            <View style={styles.thumbnailWrapper}>
              <Image source={{ uri: photo }} style={styles.thumbnail} resizeMode="cover" />
              <TouchableOpacity
                style={[styles.deleteBtn, { backgroundColor: theme.foreground }]}
                onPress={() => onPhotoChange(null)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="close" size={12} color={theme.background} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.addPhotoBtn, { borderColor: theme.border, backgroundColor: isDark ? theme.muted : "#F8F9FA" }]}
            onPress={handleAddPhoto}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-outline" size={22} color={theme.mutedForeground} />
            <Text style={[styles.addPhotoText, { color: theme.mutedForeground }]}>
              Добавить фото
            </Text>
          </TouchableOpacity>
        )}
      </View>

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
  photoSection: {
    gap: 10,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  addPhotoBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 18,
  },
  addPhotoText: {
    fontSize: 15,
    fontWeight: "500",
  },
  thumbnailRow: {
    flexDirection: "row",
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
