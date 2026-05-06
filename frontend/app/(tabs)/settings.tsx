import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import { C, R, SP } from "../../src/theme";

export default function SettingsTab() {
  const { user, refresh, logout } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api("/users/me", {
        method: "PATCH",
        body: { name: name.trim(), phone: phone.trim() },
      });
      await refresh();
      Alert.alert("Saved", "Profile updated");
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "Try again");
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    await logout();
    router.replace("/");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl }}>
        <Text style={styles.title}>Profile</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.name?.[0] || "?").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.statusRow}>
              <View style={styles.dot} />
              <Text style={styles.online}>ONLINE · ENCRYPTED</Text>
            </View>
          </View>
        </View>

        <Text style={styles.label}>DISPLAY NAME</Text>
        <TextInput
          testID="profile-name-input"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={C.muted}
          style={styles.input}
        />

        <Text style={styles.label}>PHONE NUMBER (DISCOVERY)</Text>
        <TextInput
          testID="profile-phone-input"
          value={phone}
          onChangeText={setPhone}
          placeholder="+1 555 000 0000"
          placeholderTextColor={C.muted}
          keyboardType="phone-pad"
          style={styles.input}
        />
        <Text style={styles.helper}>
          Friends can find and invite you by phone. You can clear this any time.
        </Text>

        <TouchableOpacity
          testID="save-profile-btn"
          activeOpacity={0.85}
          style={[styles.primaryBtn, saving && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={C.bg} />
          ) : (
            <>
              <Feather name="check" size={14} color={C.bg} />
              <Text style={styles.primaryBtnText}>Save changes</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.about}>
          <Feather name="shield" size={14} color={C.primary} />
          <Text style={styles.aboutText}>
            Silent Signal · zero-knowledge messaging. Your messages never reach our servers in
            plaintext.
          </Text>
        </View>

        <TouchableOpacity
          testID="logout-btn"
          activeOpacity={0.85}
          style={styles.dangerBtn}
          onPress={onLogout}
        >
          <Feather name="log-out" size={14} color={C.danger} />
          <Text style={styles.dangerBtnText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  title: {
    color: C.text,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    marginBottom: SP.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.md,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    padding: SP.md,
    marginBottom: SP.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: R.pill,
    backgroundColor: "rgba(74,222,128,0.15)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.primary, fontSize: 22, fontWeight: "700" },
  name: { color: C.text, fontSize: 17, fontWeight: "700" },
  email: { color: C.muted, fontSize: 13, marginTop: 2 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.primary },
  online: { color: C.primary, fontSize: 10, fontFamily: "monospace", letterSpacing: 1.5 },
  label: {
    color: C.muted,
    fontSize: 11,
    fontFamily: "monospace",
    letterSpacing: 1.5,
    marginTop: SP.md,
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
  helper: { color: C.muted, fontSize: 11, marginTop: 6 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: C.primary,
    borderRadius: R.pill,
    paddingVertical: 16,
    marginTop: SP.lg,
  },
  primaryBtnText: { color: C.bg, fontSize: 14, fontWeight: "700" },
  about: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    backgroundColor: "rgba(74,222,128,0.05)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    borderRadius: R.md,
    padding: SP.md,
    marginTop: SP.xl,
  },
  aboutText: { color: C.mutedAlt, fontSize: 12, flex: 1, lineHeight: 18 },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(239,68,68,0.06)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: R.pill,
    paddingVertical: 14,
    marginTop: SP.lg,
  },
  dangerBtnText: { color: C.danger, fontSize: 14, fontWeight: "600" },
});
