import { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { C, R, SP } from "../src/theme";

export default function Landing() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/(tabs)/chats");
    }
  }, [loading, user]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: C.bg }]}>
        <ActivityIndicator color={C.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Brand mark */}
        <View style={styles.brandRow} testID="brand-row">
          <View style={styles.lockBadge}>
            <Feather name="lock" size={18} color={C.primary} />
          </View>
          <Text style={styles.brandText}>Silent Signal</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>ENCRYPTED · PRIVATE · YOURS</Text>
          <Text style={styles.heroTitle}>
            Messaging built{"\n"}for the{" "}
            <Text style={{ color: C.primary }}>silent</Text>.
          </Text>
          <Text style={styles.heroSub}>
            End-to-end encrypted, invite-only, and designed to disappear. Your messages stay
            with you and the people who matter.
          </Text>

          <TouchableOpacity
            testID="cta-get-started"
            activeOpacity={0.85}
            style={styles.primaryBtn}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.primaryBtnText}>Get Started</Text>
            <Feather name="arrow-right" size={16} color={C.bg} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="cta-login"
            activeOpacity={0.7}
            style={styles.ghostBtn}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.ghostBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        {/* Features */}
        <View style={styles.featuresWrap}>
          <Text style={styles.sectionEyebrow}>WHY SILENT SIGNAL</Text>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.featureCard}>
              <View style={styles.featureIcon}>
                <Feather name={f.icon as any} size={18} color={C.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Demo credentials hint */}
        <View style={styles.hintCard}>
          <Feather name="info" size={14} color={C.primary} />
          <Text style={styles.hintText}>
            Try the demo:{" "}
            <Text style={styles.mono}>alex@silent.app</Text> /{" "}
            <Text style={styles.mono}>demo1234</Text>
          </Text>
        </View>

        <Text style={styles.footer}>© 2026 Silent Signal · End-to-end encrypted</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const FEATURES = [
  {
    icon: "lock",
    title: "End-to-end encryption",
    desc: "Messages are encrypted on your device and decrypted only by your recipient. The server never sees plaintext.",
  },
  {
    icon: "eye-off",
    title: "Vanishing messages",
    desc: "Toggle ephemeral mode and your message disappears in 2 minutes. No logs. No trace.",
  },
  {
    icon: "shield",
    title: "Invite-only groups",
    desc: "Generate a private invite code for your circle. No public discovery, no surprises.",
  },
];

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { paddingHorizontal: SP.lg, paddingBottom: SP.xxl },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingTop: SP.md,
  },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: R.sm,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  hero: { paddingTop: SP.xl + 8 },
  eyebrow: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 2,
    marginBottom: SP.md,
  },
  heroTitle: {
    color: C.text,
    fontSize: 44,
    fontWeight: "800",
    lineHeight: 48,
    letterSpacing: -1.5,
  },
  heroSub: {
    color: C.mutedAlt,
    fontSize: 15,
    lineHeight: 22,
    marginTop: SP.md,
    maxWidth: 420,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 16,
    paddingHorizontal: SP.lg,
    marginTop: SP.xl,
  },
  primaryBtnText: { color: C.bg, fontSize: 15, fontWeight: "700" },
  ghostBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    marginTop: SP.sm,
  },
  ghostBtnText: { color: C.muted, fontSize: 14 },
  featuresWrap: { marginTop: SP.xxl, gap: SP.sm },
  sectionEyebrow: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 2,
    marginBottom: SP.sm,
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SP.md,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.lg,
    padding: SP.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: R.sm,
    backgroundColor: "rgba(74,222,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { color: C.text, fontSize: 15, fontWeight: "600", marginBottom: 4 },
  featureDesc: { color: C.mutedAlt, fontSize: 13, lineHeight: 19 },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(74,222,128,0.06)",
    borderColor: "rgba(74,222,128,0.2)",
    borderWidth: 1,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.lg,
  },
  hintText: { color: C.mutedAlt, fontSize: 12, flex: 1 },
  mono: { color: C.primary, fontFamily: "monospace", fontSize: 12 },
  footer: {
    color: C.muted,
    fontSize: 11,
    textAlign: "center",
    marginTop: SP.xl,
    fontFamily: "monospace",
    letterSpacing: 0.5,
  },
});
