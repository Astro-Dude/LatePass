import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  extractToken,
  fetchInfo,
  sendNow,
  type TemplateInfo,
} from "./src/api";
import { loginWithGoogle } from "./src/auth";
import {
  DEFAULT_SETTINGS,
  getSettings,
  patchSettings,
  saveSettings,
  type Settings,
} from "./src/storage";
import { maybeAutoSend, startGeofence, stopGeofence } from "./src/geofence";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export default function App() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      Notifications.requestPermissionsAsync().catch(() => {});
      const s = await getSettings();
      setSettings(s);
      if (s.token) {
        try {
          const info = await fetchInfo(s.token);
          setTemplates(info.templates);
        } catch {
          /* offline — keep stored settings */
        }
      }
      setLoading(false);
    })();
  }, []);

  async function update(patch: Partial<Settings>) {
    const next = await patchSettings(patch);
    setSettings(next);
    return next;
  }

  async function applyToken(token: string) {
    const info = await fetchInfo(token);
    setTemplates(info.templates);
    const first = info.templates[0];
    await update({
      token,
      fromEmail: info.fromEmail,
      templateId: first?.id ?? "",
      templateLabel: first?.label ?? "",
    });
  }

  async function connectWithGoogle() {
    setBusy(true);
    setStatus("");
    try {
      const token = await loginWithGoogle();
      await applyToken(token);
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function connectWithLink() {
    const token = extractToken(linkInput);
    if (!token) return;
    setBusy(true);
    setStatus("");
    try {
      await applyToken(token);
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function captureLocation() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Location needed", "Allow location to save your spot.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await update({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setStatus("Location saved.");
    } catch {
      Alert.alert("Error", "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEnabled(value: boolean) {
    if (!value) {
      await stopGeofence();
      await update({ enabled: false });
      setStatus("Auto-send off.");
      return;
    }
    if (!TIME_RE.test(settings.time)) {
      Alert.alert("Set a time", "Enter a valid time like 21:30.");
      return;
    }
    if (settings.lat == null || settings.lng == null) {
      Alert.alert("Save your location", "Tap “Use my current location” first.");
      return;
    }
    setBusy(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        Alert.alert("Location needed");
        return;
      }
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== "granted") {
        Alert.alert(
          "Set location to “Always”",
          "Auto-send needs background location to work when the app is closed. Enable “Always” in Settings.",
        );
        return;
      }
      await startGeofence(settings.lat, settings.lng, settings.radius);
      await update({ enabled: true });
      setStatus("Armed. It'll auto-send when you arrive after your time.");
    } catch (e) {
      Alert.alert("Couldn't arm", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function manualSend() {
    if (!settings.token || !settings.templateId) return;
    setBusy(true);
    setStatus("");
    try {
      await sendNow(settings.token, settings.templateId);
      setStatus("Sent ✓");
    } catch (e) {
      Alert.alert("Send failed", e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function testNow() {
    setBusy(true);
    const result = await maybeAutoSend();
    setBusy(false);
    setStatus(`Auto-send check: ${result}`);
  }

  async function disconnect() {
    await stopGeofence();
    await saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    setTemplates([]);
    setLinkInput("");
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.brand}>LatePass</Text>

      {!settings.token ? (
        <View style={styles.card}>
          <Text style={styles.h1}>Connect your Gmail</Text>
          <Text style={styles.p}>
            Sign in once with Google (send-only access). Your late note will go
            from your own address.
          </Text>
          <Btn label="Connect Gmail" onPress={connectWithGoogle} busy={busy} />

          <Pressable
            onPress={() => setShowPaste((v) => !v)}
            style={{ marginTop: 16 }}
          >
            <Text style={styles.linkText}>
              {showPaste ? "Hide" : "Or paste a send link instead"}
            </Text>
          </Pressable>

          {showPaste ? (
            <View style={{ marginTop: 12 }}>
              <TextInput
                style={styles.input}
                placeholder="https://latepass-sage.vercel.app/t/…"
                placeholderTextColor="#666"
                autoCapitalize="none"
                autoCorrect={false}
                value={linkInput}
                onChangeText={setLinkInput}
              />
              <Btn
                label="Connect with link"
                variant="secondary"
                onPress={connectWithLink}
                busy={busy}
              />
            </View>
          ) : null}
        </View>
      ) : (
        <>
          <View style={styles.card}>
            <Text style={styles.h1}>Auto-send on arrival</Text>
            <Text style={styles.p}>
              From {settings.fromEmail}. When you arrive at your saved spot
              after your set time, your note sends automatically — even with the
              app closed.
            </Text>

            {templates.length > 1 ? (
              <View style={styles.row}>
                {templates.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() =>
                      update({ templateId: t.id, templateLabel: t.label })
                    }
                    style={[
                      styles.chip,
                      settings.templateId === t.id && styles.chipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        settings.templateId === t.id && styles.chipTextActive,
                      ]}
                    >
                      {t.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.label}>Send after (24h, e.g. 21:30)</Text>
            <TextInput
              style={styles.input}
              placeholder="21:00"
              placeholderTextColor="#666"
              keyboardType="numbers-and-punctuation"
              value={settings.time}
              onChangeText={(v) => update({ time: v })}
            />

            <Text style={styles.label}>Your spot</Text>
            <Btn
              label={
                settings.lat != null
                  ? "Update my location"
                  : "Use my current location"
              }
              variant="secondary"
              onPress={captureLocation}
              busy={busy}
            />
            <Text style={styles.hint}>
              {settings.lat != null
                ? `Saved: ${settings.lat.toFixed(4)}, ${settings.lng?.toFixed(4)} · within ${settings.radius} m`
                : "Save this while standing at the hostel."}
            </Text>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Auto-send enabled</Text>
              <Switch
                value={settings.enabled}
                onValueChange={toggleEnabled}
                trackColor={{ false: "#333", true: "#fff" }}
                thumbColor={settings.enabled ? "#000" : "#fff"}
              />
            </View>

            {status ? <Text style={styles.status}>{status}</Text> : null}
          </View>

          <View style={styles.card}>
            <Btn label="Send now" onPress={manualSend} busy={busy} />
            <View style={{ height: 10 }} />
            <Btn
              label="Test the auto-send rule"
              variant="secondary"
              onPress={testNow}
              busy={busy}
            />
            <View style={{ height: 10 }} />
            <Btn label="Disconnect" variant="ghost" onPress={disconnect} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Btn({
  label,
  onPress,
  busy,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        (pressed || busy) && { opacity: 0.6 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant !== "primary" && styles.btnTextLight,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: 20, paddingTop: 64, gap: 16 },
  brand: { color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 4 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 20,
  },
  h1: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  p: { color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 20, marginBottom: 14 },
  label: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 7,
  },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: 12.5, marginTop: 7 },
  linkText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13.5,
    textDecorationLine: "underline",
  },
  input: {
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: {
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: "#fff", borderColor: "#fff" },
  chipText: { color: "rgba(255,255,255,0.62)", fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: "#000" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  toggleLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  status: { color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 14 },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 14,
  },
  btnSecondary: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    marginTop: 0,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    marginTop: 0,
  },
  btnText: { color: "#000", fontSize: 16, fontWeight: "700" },
  btnTextLight: { color: "#fff" },
});
