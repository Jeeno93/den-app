// Пакет типизирует только свой корневой экспорт, а нам нужен глубокий путь
// (см. комментарий в sessionReplay.android.ts, почему — обход барреля с
// AmpMaskView). Переиспользуем реальный тип пакета для этого подпути, а не
// объявляем свой/any.
declare module "@amplitude/plugin-session-replay-react-native/lib/commonjs/session-replay" {
  export { SessionReplayPlugin } from "@amplitude/plugin-session-replay-react-native";
}
