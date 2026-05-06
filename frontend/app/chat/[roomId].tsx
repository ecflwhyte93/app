import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { useAuth } from "../../src/context/AuthContext";
import { api } from "../../src/lib/api";
import {
  encryptForRecipient,
  decryptFromSender,
  publicKeyFromB64,
  publicKeyToB64,
} from "../../src/lib/encryption";
import { keystore } from "../../src/lib/keystore";
import { openWS, type WSConnection } from "../../src/lib/ws";
import { C, R, SP } from "../../src/theme";

type Member = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  publicKey: string | null;
};

type Message = {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderPubKey: string | null;
  ciphertext: string;
  nonce: string;
  ephemeral: boolean;
  createdAt: string;
};

type Room = {
  id: string;
  name: string;
  type: "dm" | "group";
  inviteCode: string | null;
  members: Member[];
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ roomId: string }>();
  const roomId = String(params.roomId || "");
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [ephemeral, setEphemeral] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wsLive, setWsLive] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const wsRef = useRef<WSConnection | null>(null);

  const loadRoom = useCallback(async () => {
    try {
      const data = await api<Room>(`/rooms/${roomId}`);
      setRoom(data);
    } catch (e: any) {
      Alert.alert("Cannot open room", e?.message || "Try again");
      router.back();
    }
  }, [roomId]);

  const loadMessages = useCallback(async () => {
    try {
      const data = await api<{ items: Message[] }>(`/messages?roomId=${roomId}&limit=200`);
      // Merge: keep optimistic IDs, replace duplicates from server
      setMessages((prev) => {
        const byId = new Map<string, Message>();
        for (const m of data.items) byId.set(m.id, m);
        for (const m of prev) if (m.id.startsWith("tmp-") && !byId.has(m.id)) byId.set(m.id, m);
        return Array.from(byId.values()).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt)
        );
      });
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    loadRoom();
    loadMessages();
  }, [loadRoom, loadMessages]);

  // Polling fallback (every 8s — slow because WS handles real-time)
  useEffect(() => {
    const t = setInterval(loadMessages, 8000);
    return () => clearInterval(t);
  }, [loadMessages]);

  // WebSocket for instant delivery
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const conn = await openWS((ev) => {
        if (ev.type === "hello") {
          if (!cancelled) setWsLive(true);
          return;
        }
        if (ev.type === "message") {
          const m: Message = ev.data;
          if (!m || m.roomId !== roomId) return;
          setMessages((prev) => {
            // Replace optimistic by created_at + senderId fingerprint, or skip if id exists
            if (prev.some((x) => x.id === m.id)) return prev;
            const withoutOptimistic = prev.filter(
              (x) =>
                !(
                  x.id.startsWith("tmp-") &&
                  x.senderId === m.senderId &&
                  Math.abs(
                    new Date(x.createdAt).getTime() - new Date(m.createdAt).getTime()
                  ) < 5000
                )
            );
            return [...withoutOptimistic, m].sort((a, b) =>
              a.createdAt.localeCompare(b.createdAt)
            );
          });
        }
      });
      if (cancelled) {
        conn?.close();
      } else {
        wsRef.current = conn;
      }
    })();
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      setWsLive(false);
    };
  }, [roomId]);

  // Decrypt every message when we have keypair + room context
  useEffect(() => {
    const kp = keystore.get();
    if (!kp || !room) return;
    const memberById = new Map<string, Member>();
    for (const m of room.members) memberById.set(m.id, m);

    const updates: Record<string, string> = {};
    for (const msg of messages) {
      if (decrypted[msg.id]) continue;
      // For optimistic local messages we may have already set decrypted text
      if (!msg.ciphertext || !msg.nonce) continue;
      const senderPk = msg.senderPubKey
        ? msg.senderPubKey
        : memberById.get(msg.senderId)?.publicKey || null;
      if (!senderPk) {
        updates[msg.id] = "[no sender key]";
        continue;
      }
      const out = decryptFromSender(
        { ciphertext: msg.ciphertext, nonce: msg.nonce },
        publicKeyFromB64(senderPk),
        kp.secretKey
      );
      updates[msg.id] = out ?? "[unable to decrypt]";
    }
    if (Object.keys(updates).length) {
      setDecrypted((prev) => ({ ...prev, ...updates }));
    }
  }, [messages, room, decrypted]);

  // Auto-scroll
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  const send = async () => {
    if (!text.trim() || sending) return;
    const kp = keystore.get();
    if (!kp || !room || !user) {
      Alert.alert("Not ready", "Encryption keys not loaded — please re-login.");
      return;
    }
    setSending(true);
    try {
      // Encrypt for every member that has a public key (including ourselves)
      const encryptedFor: Record<string, { ciphertext: string; nonce: string }> = {};
      let missing = 0;
      for (const member of room.members) {
        if (!member.publicKey) {
          missing += 1;
          continue;
        }
        encryptedFor[member.id] = encryptForRecipient(
          text.trim(),
          publicKeyFromB64(member.publicKey),
          kp.secretKey
        );
      }
      // Ensure my slice exists (member should always include me, but guard)
      if (!encryptedFor[user.id]) {
        encryptedFor[user.id] = encryptForRecipient(text.trim(), kp.publicKey, kp.secretKey);
      }

      const optimistic: Message = {
        id: `tmp-${Date.now()}`,
        roomId,
        senderId: user.id,
        senderName: user.name,
        senderPubKey: publicKeyToB64(kp.publicKey),
        ciphertext: encryptedFor[user.id].ciphertext,
        nonce: encryptedFor[user.id].nonce,
        ephemeral,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimistic]);
      setDecrypted((prev) => ({ ...prev, [optimistic.id]: text.trim() }));
      const draft = text.trim();
      setText("");

      try {
        await api<Message>("/messages", {
          method: "POST",
          body: {
            roomId,
            encryptedFor,
            senderPubKey: publicKeyToB64(kp.publicKey),
            ephemeral,
          },
        });
      } catch (e) {
        // Restore the input on failure
        setText(draft);
        // Remove the optimistic message
        setMessages((prev) => prev.filter((x) => x.id !== optimistic.id));
        throw e;
      }

      if (missing > 0) {
        Alert.alert(
          "Heads up",
          `${missing} room member(s) haven't logged in yet — they'll see your message after they log in.`
        );
      }
    } catch (e: any) {
      Alert.alert("Failed to send", e?.message || "Try again");
    } finally {
      setSending(false);
    }
  };

  const copyInvite = async () => {
    if (!room?.inviteCode) return;
    await Clipboard.setStringAsync(room.inviteCode);
    Alert.alert("Copied", `Invite code "${room.inviteCode}" copied to clipboard`);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="chat-back"
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={10}
        >
          <Feather name="arrow-left" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.avatar}>
          {room?.type === "group" ? (
            <Feather name="users" size={16} color={C.primary} />
          ) : (
            <Text style={styles.avatarText}>
              {(room?.name?.[0] || "?").toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.headerName} numberOfLines={1}>
            {room?.name || "Loading..."}
          </Text>
          <View style={styles.headerSubRow}>
            <Feather name="lock" size={10} color={C.primary} />
            <Text style={styles.headerSub}>
              {room?.type === "group"
                ? `${room.members?.length || 0} MEMBERS · NACL E2E`
                : "END-TO-END · NACL"}
            </Text>
            <View style={[styles.liveDot, wsLive && styles.liveDotOn]} />
            <Text style={[styles.liveText, wsLive && { color: C.primary }]}>
              {wsLive ? "LIVE" : "POLLING"}
            </Text>
          </View>
        </View>
        {room?.type === "group" && room.inviteCode && (
          <TouchableOpacity
            testID="copy-invite-btn"
            onPress={copyInvite}
            style={styles.copyHeaderBtn}
            hitSlop={8}
          >
            <Feather name="copy" size={14} color={C.primary} />
            <Text style={styles.copyHeaderText} numberOfLines={1}>
              {room.inviteCode}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="shield" size={28} color={C.primary} />
            </View>
            <Text style={styles.emptyTitle}>Conversation starts here</Text>
            <Text style={styles.emptyDesc}>
              Each message is encrypted on your device with the recipient's public key. The
              server only sees ciphertext.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messages}
            renderItem={({ item }) => {
              const isOwn = item.senderId === user?.id;
              const txt = decrypted[item.id] ?? "[decrypting…]";
              return (
                <View
                  style={[styles.bubbleWrap, isOwn ? styles.bubbleOwn : styles.bubbleOther]}
                  testID={`message-${item.id}`}
                >
                  {!isOwn && room?.type === "group" && (
                    <Text style={styles.senderName}>{item.senderName}</Text>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      isOwn ? styles.bubbleOwnStyle : styles.bubbleOtherStyle,
                    ]}
                  >
                    {item.ephemeral && (
                      <View style={styles.vanishRow}>
                        <Feather name="eye-off" size={11} color={C.primary} />
                        <Text style={styles.vanishText}>VANISHING · 2 MIN</Text>
                      </View>
                    )}
                    <Text style={styles.bubbleText}>{txt}</Text>
                  </View>
                  <View style={[styles.metaRow, isOwn ? { alignSelf: "flex-end" } : null]}>
                    <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                    {isOwn && <Feather name="check" size={11} color={C.primary} />}
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Input bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            testID="ephemeral-toggle"
            onPress={() => setEphemeral((v) => !v)}
            style={[styles.ephBtn, ephemeral && styles.ephBtnOn]}
            hitSlop={6}
          >
            <Feather
              name={ephemeral ? "eye-off" : "eye"}
              size={14}
              color={ephemeral ? C.primary : C.muted}
            />
            <Text
              style={{
                color: ephemeral ? C.primary : C.muted,
                fontSize: 11,
                fontFamily: "monospace",
                letterSpacing: 1,
              }}
            >
              {ephemeral ? "VANISH" : "NORMAL"}
            </Text>
          </TouchableOpacity>
          <TextInput
            testID="message-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a secure message…"
            placeholderTextColor={C.muted}
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            testID="send-message-btn"
            disabled={!text.trim() || sending}
            onPress={send}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            hitSlop={6}
          >
            <Feather name="send" size={16} color={C.bg} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SP.sm,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    backgroundColor: "rgba(74,222,128,0.12)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: C.primary, fontSize: 14, fontWeight: "700" },
  headerName: { color: C.text, fontSize: 15, fontWeight: "600" },
  headerSubRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  headerSub: { color: C.primary, fontSize: 10, fontFamily: "monospace", letterSpacing: 1 },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.muted,
    marginLeft: 6,
  },
  liveDotOn: { backgroundColor: C.primary },
  liveText: {
    color: C.muted,
    fontSize: 9,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  copyHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(74,222,128,0.1)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.3)",
    paddingHorizontal: SP.sm,
    paddingVertical: 6,
    borderRadius: R.sm,
    maxWidth: 120,
  },
  copyHeaderText: { color: C.primary, fontSize: 11, fontFamily: "monospace" },

  messages: { paddingHorizontal: SP.md, paddingVertical: SP.md, gap: SP.sm },
  bubbleWrap: { maxWidth: "80%" },
  bubbleOwn: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubbleOther: { alignSelf: "flex-start", alignItems: "flex-start" },
  senderName: { color: C.muted, fontSize: 11, marginBottom: 4, marginLeft: 4 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleOwnStyle: {
    backgroundColor: C.border,
    borderBottomRightRadius: 6,
  },
  bubbleOtherStyle: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderBottomLeftRadius: 6,
  },
  bubbleText: { color: C.text, fontSize: 14, lineHeight: 20 },
  vanishRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  vanishText: { color: C.primary, fontSize: 9, fontFamily: "monospace", letterSpacing: 1 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    marginHorizontal: 4,
  },
  timeText: { color: C.muted, fontSize: 10, fontFamily: "monospace" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: SP.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: R.pill,
    backgroundColor: "rgba(74,222,128,0.08)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { color: C.text, fontSize: 16, fontWeight: "600", marginTop: SP.md },
  emptyDesc: {
    color: C.mutedAlt,
    fontSize: 13,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 320,
    lineHeight: 19,
  },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SP.sm,
    paddingHorizontal: SP.md,
    paddingVertical: SP.sm,
    borderTopWidth: 1,
    borderTopColor: C.border,
    backgroundColor: C.bg,
  },
  ephBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: SP.sm,
    paddingVertical: 8,
    borderRadius: R.sm,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 4,
  },
  ephBtnOn: {
    borderColor: "rgba(74,222,128,0.5)",
    backgroundColor: "rgba(74,222,128,0.1)",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: R.lg,
    paddingHorizontal: SP.md,
    paddingVertical: 10,
    color: C.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: R.pill,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 0,
  },
});
