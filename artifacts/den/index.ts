import "expo-router/entry";
import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { moodWidgetTaskHandler } from "./src/widgets/widgetTaskHandler";

// Виджет на главном экране может обновляться, когда основной JS-контекст
// приложения (и с ним app/_layout.tsx) вообще не запущен — Expo Router
// лениво подгружает route-модули только при реальном старте UI, поэтому
// регистрация headless-задачи должна жить в настоящей точке входа бандла,
// а не внутри _layout.tsx. См. https://saleksovski.github.io/react-native-android-widget/docs/tutorial/register-task-handler
if (Platform.OS === "android") {
  registerWidgetTaskHandler(moodWidgetTaskHandler);
}
