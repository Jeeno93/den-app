import React from "react";
import type { ViewProps } from "react-native";
// Импортируем конкретный файл, а не корень пакета — та же причина, что и в
// sessionReplay.android.ts: index.js пакета тянет за собой ещё и другие
// нативные компоненты через requireNativeComponent на верхнем уровне модуля,
// что ломает сборку уже само по себе, до какого-либо Platform.OS-ветвления.
import { AmpMaskView } from "@amplitude/plugin-session-replay-react-native/lib/commonjs/app-mask-view";

/**
 * Оборачивает личный текст пользователя (ответы, заметки, гордость дня, фото)
 * так, чтобы Session Replay его не записывал. maskLevel "medium" маскирует
 * только активные TextInput в момент печати — уже СОХРАНЁННый и просто
 * отображаемый текст (Text) он не трогает, а именно в этом виде пользователь
 * проводит в приложении почти всё время. Это отдельный, явный маск поверх.
 */
export function MaskView({ children, style }: ViewProps & { children?: React.ReactNode }) {
  return (
    <AmpMaskView mask="amp-mask" style={style}>
      {children}
    </AmpMaskView>
  );
}
