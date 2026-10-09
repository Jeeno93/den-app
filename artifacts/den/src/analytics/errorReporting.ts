import * as amplitude from "@amplitude/analytics-react-native";

/**
 * Ошибки JavaScript уходят в Amplitude событием `js_error`.
 *
 * Без этого мы были слепы: ошибку отрисовки ловит корневой ErrorBoundary и
 * показывает экран «перезапустить», в рабочей сборке текст ошибки скрыт, а
 * AppMetrica видит только нативные падения. Так экран «Как проходят дни»
 * ломался у пользователя, а в отчётах не было ничего.
 *
 * Текст записей сюда попасть не должен: сообщение об ошибке и стек содержат
 * имена функций и файлов, а не данные. Длины обрезаем, чтобы событие не
 * раздувалось.
 */
export function reportJsError(
  error: unknown,
  context: { source: string; fatal?: boolean; screen?: string; componentStack?: string },
): void {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    amplitude.track("js_error", {
      message: err.message.slice(0, 300),
      name: err.name,
      stack: (err.stack ?? "").split("\n").slice(0, 12).join("\n").slice(0, 1500),
      component_stack: context.componentStack?.split("\n").slice(0, 12).join("\n").slice(0, 1500),
      source: context.source,
      fatal: context.fatal ?? false,
      screen: context.screen,
    });
    amplitude.flush();
  } catch {}
}

/**
 * Ошибки вне отрисовки (обработчики нажатий, промисы, таймеры) ErrorBoundary
 * не видит. Перехватываем глобальный обработчик и передаём ошибку дальше
 * штатному. Фатальную задерживаем на секунду, чтобы событие успело уйти до
 * того, как процесс упадёт.
 */
export function installGlobalErrorHandler(): void {
  const errorUtils = (globalThis as { ErrorUtils?: {
    getGlobalHandler: () => (error: unknown, isFatal?: boolean) => void;
    setGlobalHandler: (handler: (error: unknown, isFatal?: boolean) => void) => void;
  } }).ErrorUtils;
  if (!errorUtils) return;
  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportJsError(error, { source: "global", fatal: !!isFatal });
    if (isFatal) {
      setTimeout(() => previous(error, isFatal), 1000);
    } else {
      previous(error, isFatal);
    }
  });
}
