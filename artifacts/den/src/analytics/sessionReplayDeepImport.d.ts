// Пакет типизирует только свой корневой экспорт, а нам нужен глубокий путь
// (см. комментарий в sessionReplay.android.ts, почему — обход барреля с
// AmpMaskView). Переиспользуем реальный тип пакета для этого подпути, а не
// объявляем свой/any.
declare module "@amplitude/plugin-session-replay-react-native/lib/commonjs/session-replay" {
  export { SessionReplayPlugin } from "@amplitude/plugin-session-replay-react-native";
}

// То же самое для MaskView.android.tsx: он тоже импортирует напрямую из
// lib/commonjs, а .d.ts пакета лежат в lib/typescript, и без exports/
// typesVersions в его package.json TypeScript их по этому пути не находит.
declare module "@amplitude/plugin-session-replay-react-native/lib/commonjs/app-mask-view" {
  export { AmpMaskView } from "@amplitude/plugin-session-replay-react-native";
}
