import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { api } from "../src/lib/api";
import { C, R, SP } from "../src/theme";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [demoLink, setDemoLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      const data = await api<{ ok: boolean; demo_link: string | null }>(
        "/auth/forgot-password",
        { method: "POST", body: { email: email.trim() }, auth: false }
      );
      setSent(true);
      setDemoLink(data.demo_link);
    } catch (e: any) {
      setError(e?.message || "Could not send reset request");
    } finally {
      setLoading(false);
    }
  };

  const openLink = () => {
    if (!demoLink) return;
    // Extract token and navigate within the app
    const m = demoLink.match(/token=([^&]+)/);
    const token = m?.[1];
    if (token) {
      router.replace(`/reset-password?token=${encodeURIComponent(token)}`);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            testID="back-button"
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Feather name="arrow-left" size={20} color={C.text} />
          </TouchableOpacity>

          <View style={styles.lockBadge}>
            <Feather name="key" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>Forgot password</Text>
          <Text style={styles.subtitle}>
            We'll send a one-time reset link to your email. Reset is single-use and expires in
            1 hour.
          </Text>

          {/* Important warning — keypair rotation */}
          <View style={styles.warnCard}>
            <Feather name="alert-triangle" size={14} color="#fbbf24" />
            <View style={{ flex: 1 }}>
              <Text style={styles.warnTitle}>Heads up — keypair rotation</Text>
              <Text style={styles.warnText}>
                Your encryption keys are derived from your password. Resetting your password
                generates a brand-new keypair, which means past encrypted messages will become
                permanently unreadable.
              </Text>
            </View>
          </View>

          {!sent ? (
            <>
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                testID="forgot-email-input"
                value={email}
                onChangeText={setEmail}
                placeholder="you@silent.app"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />

              {error && (
                <View style={styles.errorCard}>
                  <Feather name="alert-triangle" size={14} color={C.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                testID="forgot-submit"
                disabled={loading || !email}
                onPress={submit}
                activeOpacity={0.85}
                style={[styles.primaryBtn, (loading || !email) && { opacity: 0.5 }]}
              >
                {loading ? (
                  <ActivityIndicator color={C.bg} />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Send reset link</Text>
                    <Feather name="arrow-right" size={16} color={C.bg} />
                  </>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.sentCard} testID="forgot-sent-card">
              <Feather name="mail" size={32} color={C.primary} />
              <Text style={styles.sentTitle}>If an account exists, a link is on its way.</Text>
              <Text style={styles.sentSub}>
                Check your inbox for the reset email. The link is valid for 1 hour and can only
                be used once.
              </Text>
              {demoLink && (
                <View style={styles.demoBlock}>
                  <Text style={styles.demoLabel}>DEMO MODE — RESET LINK</Text>
                  <Text style={styles.demoLink} numberOfLines={2} testID="forgot-demo-link">
                    {demoLink}
                  </Text>
                  <View style={{ flexDirection: "row", gap: SP.sm, marginTop: SP.sm }}>
                    <TouchableOpacity
                      style={styles.ghostBtn}
                      onPress={async () => {
                        await Clipboard.setStringAsync(demoLink);
                      }}
                    >
                      <Feather name="copy" size={14} color={C.text} />
                      <Text style={styles.ghostBtnText}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, { marginTop: 0, flex: 1 }]}
                      onPress={openLink}
                      testID="forgot-open-link"
                    >
                      <Text style={styles.primaryBtnText}>Open reset link</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={styles.footer}>
            <TouchableOpacity testID="back-to-login" onPress={() => router.replace("/login")}>
              <Text style={[styles.footerText, { color: C.primary }]}>Back to sign in</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: SP.lg, paddingTop: SP.md },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBadge: {
    width: 56,
    height: 56,
    borderRadius: R.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SP.xl,
  },
  title: {
    color: C.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -0.8,
    marginTop: SP.lg,
  },
  subtitle: { color: C.mutedAlt, fontSize: 14, marginTop: 6, lineHeight: 20 },
  warnCard: {
    flexDirection: "row",
    gap: SP.sm,
    backgroundColor: "rgba(251,191,36,0.06)",
    borderColor: "rgba(251,191,36,0.3)",
    borderWidth: 1,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.lg,
  },
  warnTitle: { color: "#fbbf24", fontSize: 13, fontWeight: "700", marginBottom: 4 },
  warnText: { color: C.mutedAlt, fontSize: 12, lineHeight: 17 },
  label: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginTop: SP.lg,
    marginBottom: SP.sm,
  },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: SP.md,
    paddingVertical: 14,
    color: C.text,
    fontSize: 15,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.md,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SP.sm,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 16,
    marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 15, fontWeight: "700" },
  ghostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: C.surface,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: R.pill,
    paddingVertical: 14,
    paddingHorizontal: SP.lg,
  },
  ghostBtnText: { color: C.text, fontSize: 14, fontWeight: "600" },
  sentCard: {
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(74,222,128,0.05)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.25)",
    borderRadius: R.md,
    padding: SP.lg,
    marginTop: SP.lg,
  },
  sentTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    marginTop: SP.sm,
  },
  sentSub: {
    color: C.mutedAlt,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  demoBlock: {
    width: "100%",
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.4)",
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.md,
  },
  demoLabel: {
    color: C.muted,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  demoLink: {
    color: C.primary,
    fontSize: 11,
    fontFamily: "monospace",
  },
  footer: { alignItems: "center", marginTop: SP.xxl },
  footerText: { fontSize: 14 },
});
