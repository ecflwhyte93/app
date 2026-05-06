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
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/context/AuthContext";
import { isValidRecoveryPhrase } from "../src/lib/encryption";
import { C, R, SP } from "../src/theme";

export default function EnterPhrase() {
  const { user, applyRecoveryPhrase, logout } = useAuth();
  const [phrase, setPhrase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    const cleaned = phrase.trim().toLowerCase().split(/\s+/).filter(Boolean).join(" ");
    if (cleaned.split(" ").length !== 24) {
      setError("A recovery phrase has exactly 24 words.");
      return;
    }
    if (!isValidRecoveryPhrase(cleaned)) {
      setError("That phrase isn't valid. Check the words and word order.");
      return;
    }
    setLoading(true);
    try {
      await applyRecoveryPhrase(cleaned);
      router.replace("/(tabs)/chats");
    } catch (e: any) {
      setError(e?.message || "Could not unlock");
    } finally {
      setLoading(false);
    }
  };

  const cancel = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.lockBadge}>
            <Feather name="key" size={26} color={C.primary} />
          </View>
          <Text style={styles.title}>Unlock with recovery phrase</Text>
          <Text style={styles.subtitle}>
            We don't have your encryption keys on this device. Paste your 24-word recovery phrase
            to restore access to your encrypted history.
          </Text>

          <Text style={styles.label}>RECOVERY PHRASE</Text>
          <TextInput
            testID="phrase-input"
            value={phrase}
            onChangeText={setPhrase}
            placeholder="word1 word2 word3 ... (separated by spaces)"
            placeholderTextColor={C.muted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={6}
            style={[styles.input, { minHeight: 130, textAlignVertical: "top", fontFamily: "monospace", fontSize: 14 }]}
          />

          {error && (
            <View style={styles.errorCard} testID="phrase-error">
              <Feather name="alert-triangle" size={14} color={C.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            testID="phrase-submit"
            disabled={loading || !phrase.trim()}
            onPress={submit}
            activeOpacity={0.85}
            style={[styles.primaryBtn, (loading || !phrase.trim()) && { opacity: 0.5 }]}
          >
            {loading ? (
              <ActivityIndicator color={C.bg} />
            ) : (
              <>
                <Text style={styles.primaryBtnText}>Unlock</Text>
                <Feather name="unlock" size={16} color={C.bg} />
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity testID="phrase-cancel" onPress={cancel} style={{ marginTop: SP.md }}>
            <Text style={styles.cancelText}>Sign out instead</Text>
          </TouchableOpacity>

          {!!user && (
            <Text style={styles.hint}>
              Logged in as <Text style={{ color: C.primary, fontFamily: "monospace" }}>{user.email}</Text>
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: SP.lg, paddingTop: SP.xl },
  lockBadge: {
    width: 56, height: 56, borderRadius: R.md, backgroundColor: C.surface,
    borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center",
  },
  title: { color: C.text, fontSize: 28, fontWeight: "700", letterSpacing: -0.8, marginTop: SP.lg },
  subtitle: { color: C.mutedAlt, fontSize: 14, marginTop: 6, lineHeight: 20 },
  label: {
    color: C.muted, fontSize: 11, fontFamily: "monospace", letterSpacing: 1.5,
    marginTop: SP.lg, marginBottom: SP.sm,
  },
  input: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border, borderRadius: R.md,
    paddingHorizontal: SP.md, paddingVertical: 14, color: C.text, fontSize: 15,
  },
  errorCard: {
    flexDirection: "row", alignItems: "center", gap: SP.sm,
    backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)",
    borderWidth: 1, borderRadius: R.md, padding: SP.md, marginTop: SP.md,
  },
  errorText: { color: "#fca5a5", fontSize: 13, flex: 1 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SP.sm,
    backgroundColor: C.primary, borderRadius: R.pill, paddingVertical: 16, marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 15, fontWeight: "700" },
  cancelText: { color: C.muted, fontSize: 13, textAlign: "center" },
  hint: { color: C.muted, fontSize: 12, textAlign: "center", marginTop: SP.lg },
});
