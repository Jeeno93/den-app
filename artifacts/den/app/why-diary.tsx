import React from "react";
import {
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BG = "#1a5c42";
const CARD_BG = "rgba(255,255,255,0.10)";
const CARD_BORDER = "rgba(255,255,255,0.18)";
const WHITE = "#ffffff";
const WHITE_DIM = "rgba(255,255,255,0.75)";
const ACCENT = "#3D9970";

const BLOCKS = [
  {
    emoji: "🧠",
    title: "Мозг не умеет хранить информацию о прожитом дне",
    text: "Каждый вечер гиппокамп решает, что оставить в памяти, а что удалить. Без записи большинство моментов стирается из памяти за 24 часа. Дневник — это внешняя память, которая ничего не забывает.",
  },
  {
    emoji: "🔬",
    title: "Рефлексия меняет химический состав мозга",
    text: "Когда вы описываете событие словами, префронтальная кора берет контроль над миндалевидным телом. Тревожность снижается, эмоции становятся более ясными. Это не метафора, а нейробиологический факт.",
  },
  {
    emoji: "📊",
    title: "Привычки, которые ты не замечаешь",
    text: "Через месяц записей ты увидишь, что портит тебе настроение, кто заряжает тебя энергией, в какие дни ты продуктивен. Мозг плохо замечает привычки, а записи — замечают.",
  },
  {
    emoji: "📖",
    title: "Письмо себе в будущее",
    text: "Читать записи годичной давности — одно из самых странных и сильных переживаний. Ты видишь, кем был, как изменился, что осталось важным. Без дневника это невозможно.",
  },
];

const SHARE_TEXT =
  "Я веду дневник в приложении Den — оно каждый вечер задает пять вопросов. Вот почему это работает: https://play.google.com/store/apps/details?id=com.den";

async function handleShare() {
  try {
    await Share.share({ message: SHARE_TEXT });
  } catch {}
}

export default function WhyDiaryScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={WHITE} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Зачем вести дневник?</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: (Platform.OS === "web" ? 34 : insets.bottom + 24) + 80 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {BLOCKS.map((block, i) => (
          <View key={i} style={styles.card}>
            <Text style={styles.cardEmoji}>{block.emoji}</Text>
            <Text style={styles.cardTitle}>{block.title}</Text>
            <Text style={styles.cardText}>{block.text}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Platform.OS === "web" ? 24 : insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Ionicons name="share-social-outline" size={20} color={BG} />
          <Text style={styles.shareBtnText}>Поделиться</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 14,
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    borderRadius: 20,
    padding: 20,
    gap: 10,
  },
  cardEmoji: {
    fontSize: 36,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: WHITE,
    lineHeight: 24,
  },
  cardText: {
    fontSize: 15,
    color: WHITE_DIM,
    lineHeight: 23,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: BG,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 15,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: BG,
  },
});
