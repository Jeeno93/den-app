import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";

const PHOTOS_DIR =
  Platform.OS === "web" || !FileSystem.documentDirectory
    ? null
    : FileSystem.documentDirectory + "photos/";

async function ensurePhotosDir(): Promise<void> {
  if (!PHOTOS_DIR) return;
  const info = await FileSystem.getInfoAsync(PHOTOS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(PHOTOS_DIR, { intermediates: true });
    console.log(`[photoStorage] created directory ${PHOTOS_DIR}`);
  }
}

function detectExt(uri: string): string {
  const m = uri.match(/\.(jpg|jpeg|png|webp|heic|heif)(\?|$)/i);
  return (m?.[1] ?? "jpg").toLowerCase();
}

function uniqueName(ext: string): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

/**
 * Copies a photo from the image picker into permanent app storage.
 * Returns a string suitable for use as <Image source={{ uri }}>.
 *
 * - Native: copies to documentDirectory/photos/ and returns the file:// path
 * - Web: converts the picker's blob: URL to a base64 data URL so it
 *   survives AsyncStorage round-trip (no real filesystem on web)
 */
export async function savePhoto(sourceUri: string): Promise<string> {
  if (Platform.OS === "web" || !PHOTOS_DIR) {
    const res = await fetch(sourceUri);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  await ensurePhotosDir();
  const dest = PHOTOS_DIR + uniqueName(detectExt(sourceUri));
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  try {
    const info = await FileSystem.getInfoAsync(dest);
    const sizeKB = info.exists && "size" in info ? Math.round((info.size ?? 0) / 1024) : 0;
    console.log(`[photoStorage] saved photo: ${dest} (${sizeKB} KB)`);
  } catch {}
  return dest;
}

/**
 * Deletes a photo file from disk. Safe to call with:
 * - file:// paths (deletes the file)
 * - data: URIs (no-op; legacy base64 entries)
 * - http(s):// URIs (no-op)
 */
export async function deletePhoto(path: string): Promise<void> {
  if (!path) return;
  if (!path.startsWith("file:")) return;
  try {
    await FileSystem.deleteAsync(path, { idempotent: true });
    console.log(`[photoStorage] deleted photo: ${path}`);
  } catch (err) {
    console.warn("[photoStorage] deletePhoto failed:", err);
  }
}
