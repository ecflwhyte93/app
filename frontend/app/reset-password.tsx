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
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../src/lib/api";
import { C, R, SP } from "../src/theme";

export default function ResetPassword() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(String(params.token || ""));
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError(null);
    if (!token.trim()) {
      setError("Reset token is required");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirm) {
      setError("Passwords don't match");
      return;
    }
    if (!acknowledged) {
      setError("Please confirm you understand the keypair rotation impact");
      return;
    }
    setLoading(true);
    try {
      await api("/auth/reset-password", {
        method: "POST",
        body: { token: token.trim(), new_password: newPassword },
        auth: false,
      });
      setDone(true);
    } catch (e: any) {
      setError(e?.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.scroll}>
          <View style={styles.lockBadge}>
            <Feather name="check-circle" size={32} color={C.primary} />
          </View>
          <Text style={styles.title}>Password reset</Text>
          <Text style={styles.subtitle}>
            Your password has been updated and a fresh encryption keypair has been generated.
            Sign in with your new password to upload the new public key.
          </Text>
          <TouchableOpacity
            testID="reset-go-to-login"
            style={styles.primaryBtn}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.primaryBtnText}>Sign in</Text>
            <Feather name="arrow-right" size={16} color={C.bg} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
            <Feather name="refresh-cw" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>Choose a new password for your account.</Text>

          {/* Severe warning — keypair rotation deletes message history access */}
          <View style={styles.dangerCard}>
            <Feather name="alert-triangle" size={16} color={C.danger} />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerTitle}>You are about to rotate your encryption keys</Text>
              <Text style={styles.dangerText}>
                Silent Signal derives your encryption keypair from your password. Continuing will:
              </Text>
              <View style={{ marginTop: SP.sm, gap: 4 }}>
                <Text style={styles.bullet}>• Generate a brand new Curve25519 keypair</Text>
                <Text style={styles.bullet}>
                  • Make every encrypted message you've sent or received{" "}
                  <Text style={{ color: C.danger, fontWeight: "700" }}>permanently unreadable</Text>{" "}
                  to you
                </Text>
                <Text style={styles.bullet}>
                  • Allow friends to send you messages again — once you log in
                </Text>
              </View>
            </View>
          </View>

          {!params.token && (
            <>
              <Text style={styles.label}>RESET TOKEN</Text>
              <TextInput
                testID="reset-token-input"
                value={token}
                onChangeText={setToken}
                placeholder="Paste the token from the reset link"
                placeholderTextColor={C.muted}
                autoCapitalize="none"
                style={[styles.input, { fontFamily: "monospace", fontSize: 12 }]}
              />
            </>
          )}

          <Text style={styles.label}>NEW PASSWORD</Text>
          <TextInput
            testID="reset-new-password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="At least 6 characters"
            placeholderTextColor={C.muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <TextInput
            testID="reset-confirm-password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Re-enter password"
            placeholderTextColor={C.muted}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          <TouchableOpacity
            testID="reset-acknowledge-toggle"
            style={[styles.checkRow, acknowledged && styles.checkRowOn]}
            onPress={() => setAcknowledged((v) => !v)}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, acknowledged && styles.checkboxOn]}>
              {acknowledged && <Feather name="check" size={12} color={C.bg} />}
            </View>
            <Text style={styles.checkText}>
              I understand my old encrypted messages will become unreadable.
            </Text>
          </TouchableOpacity>

          {error && (
            <View style={styles.errorCard} testID="reset-error">
              <Feather name="alert-triangle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="reset-submit"
            disabled={loading || !token || !newPassword || !confirm || !acknowledged}
            onPress={submit}
            activeOpacity={0.85}
            style={[
              styles.primaryBtn,
              (loading || !token || !newPassword || !confirm || !acknowledged) && {
                opacity: 0.5,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Reset password & rotate keys</Text>
              </>
            )}
          </TouchableOpacity>
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
  title: { color: C.text, fontSize: 30, fontWeight: "700", letterSpacing: -0.8, marginTop: SP.lg },
  subtitle: { color: C.mutedAlt, fontSize: 14, marginTop: 6, lineHeight: 20 },
  dangerCard: {
    flexDirection: "row",
    gap: SP.sm,
    backgroundColor: "rgba(239,68,68,0.06)",
    borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.lg,
  },
  dangerTitle: { color: C.danger, fontSize: 13, fontWeight: "700", marginBottom: 4 },
  dangerText: { color: C.text, fontSize: 13, lineHeight: 19 },
  bullet: { color: C.mutedAlt, fontSize: 12, lineHeight: 17 },
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
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.md,
  },
  checkRowOn: { borderColor: "rgba(74,222,128,0.5)" },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  checkText: { color: C.text, fontSize: 13, flex: 1, lineHeight: 18 },
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
});
