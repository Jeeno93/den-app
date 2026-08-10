import * as amplitude from "@amplitude/analytics-react-native";
// Импортируем конкретный файл, а не корень пакета — index.ts пакета
// реэкспортирует ещё и AmpMaskView (native UI-компонент через
// requireNativeComponent на верхнем уровне модуля), и это ломает сборку
// уже само по себе, до какого-либо Platform.OS-ветвления. Обходим барр
// целиком, а не полагаемся только на android/web-сплит этого файла.
import { SessionReplayPlugin } from "@amplitude/plugin-session-replay-react-native/lib/commonjs/session-replay";

/**
 * Записываем 100% сессий — трафик пока небольшой, каждая сессия ценна для
 * анализа поведения. maskLevel не задаём явно — дефолт "medium" маскирует
 * все TextInput, что важно именно для дневника с личными записями: сама
 * структура экранов видна в записи, а текст настроений/заметок — нет.
 *
 * Android-only файл (см. sessionReplay.ts для no-op на web/iOS) — как и с
 * AppMetrica, прямой импорт нативного плагина ломает Metro web-сборку на
 * уровне импорта модуля (requireNativeComponent), а не вызова, поэтому
 * платформенный сплит обязателен, а не Platform.OS-guard внутри общего файла.
 */
export function initSessionReplay() {
  amplitude.add(new SessionReplayPlugin({ sampleRate: 1 }));
}
