import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import {
  BASE,
  type AppState,
  type AppTemplate,
  type TemplateInput,
  loadState,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  setDailyCap,
  sendNow,
} from "./src/api";
import { loginWithGoogle } from "./src/auth";
import {
  DEFAULT_SETTINGS,
  getSettings,
  patchSettings,
  saveSettings,
  type Settings,
} from "./src/storage";
import { runAutoCheck, startAutoSend, stopAutoSend } from "./src/geofence";
import { CC_OPTIONS, RECIPIENT_OPTIONS } from "./src/contacts";
import { renderTemplate } from "./src/render";

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
type Screen = "home" | "templates" | "auto" | "profile";

function msg(e: unknown): string {
  return e instanceof Error ? e.message : "Something went wrong.";
}

function todayLabel(): string {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function toInput(d: AppTemplate): TemplateInput {
  return {
    label: d.label,
    recipient: d.recipient,
    cc: d.cc ? d.cc : null,
    subject: d.subject,
    body: d.body,
    field_name: d.field_name,
    field_room: d.field_room,
    field_roll: d.field_roll,
    field_arrival_time: d.field_arrival_time,
    field_reason: d.field_reason,
  };
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [app, setApp] = useState<AppState | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [sendSel, setSendSel] = useState("");
  const [draft, setDraft] = useState<AppTemplate | null>(null);
  const [toast, setToast] = useState("");
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string) {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(() => setToast(""));
    }, 1900);
  }

  useEffect(() => {
    (async () => {
      Notifications.requestPermissionsAsync().catch(() => {});
      const s = await getSettings();
      setSettings(s);
      if (s.manageToken) {
        try {
          const st = await loadState(s.manageToken);
          setApp(st);
          setSendSel(st.templates[0]?.id ?? "");
          await patchSettings({
            sendToken: st.sendToken,
            fromEmail: st.fromEmail,
          });
        } catch {
          /* offline */
        }
      }
      setLoading(false);
    })();
  }, []);

  async function upd(patch: Partial<Settings>) {
    const next = await patchSettings(patch);
    setSettings(next);
    return next;
  }

  async function refresh(manageToken: string) {
    const st = await loadState(manageToken);
    setApp(st);
    await patchSettings({ sendToken: st.sendToken, fromEmail: st.fromEmail });
    return st;
  }

  async function connect() {
    setBusy(true);
    try {
      const manageToken = await loginWithGoogle();
      await upd({ manageToken });
      const st = await refresh(manageToken);
      setSendSel(st.templates[0]?.id ?? "");
      setScreen("home");
    } catch (e) {
      Alert.alert("Sign-in", msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    await stopAutoSend();
    await saveSettings(DEFAULT_SETTINGS);
    setSettings(DEFAULT_SETTINGS);
    setApp(null);
    setDraft(null);
    setScreen("home");
  }

  function goTo(s: Screen) {
    if (s === "templates" && app) {
      const cur = app.templates.find((t) => t.id === draft?.id) ?? app.templates[0];
      setDraft(cur ? { ...cur } : null);
    }
    setScreen(s);
  }

  async function doSend(templateId: string): Promise<boolean> {
    if (!settings.sendToken || !templateId) return false;
    try {
      await sendNow(settings.sendToken, templateId);
      return true;
    } catch (e) {
      Alert.alert("Send failed", msg(e));
      return false;
    }
  }

  function patchDraft(patch: Partial<AppTemplate>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  async function saveDraft() {
    if (!draft || !settings.manageToken) return;
    setBusy(true);
    try {
      await updateTemplate(settings.manageToken, draft.id, toInput(draft));
      await refresh(settings.manageToken);
      showToast("Template saved");
    } catch (e) {
      Alert.alert("Couldn't save", msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function addTemplate() {
    if (!settings.manageToken) return;
    setBusy(true);
    try {
      const t = await createTemplate(settings.manageToken);
      await refresh(settings.manageToken);
      setDraft({ ...t });
      showToast("Template added");
    } catch (e) {
      Alert.alert("Couldn't add", msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate() {
    if (!draft || !settings.manageToken || !app || app.templates.length <= 1) {
      Alert.alert("Can't delete your only template.");
      return;
    }
    setBusy(true);
    try {
      await deleteTemplate(settings.manageToken, draft.id);
      const st = await refresh(settings.manageToken);
      setDraft(st.templates[0] ? { ...st.templates[0] } : null);
      showToast("Template deleted");
    } catch (e) {
      Alert.alert("Couldn't delete", msg(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveCap(cap: number) {
    if (!settings.manageToken) return;
    try {
      await setDailyCap(settings.manageToken, cap);
      await refresh(settings.manageToken);
      showToast("Daily limit updated");
    } catch (e) {
      Alert.alert("Couldn't save", msg(e));
    }
  }

  async function captureLocation() {
    setBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") return Alert.alert("Location needed");
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      await upd({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      showToast("Location saved");
    } catch {
      Alert.alert("Error", "Couldn't get your location.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleAuto(value: boolean) {
    if (!value) {
      await stopAutoSend();
      await upd({ autoEnabled: false });
      showToast("Auto-send off");
      return;
    }
    if (!settings.autoTemplateId)
      return Alert.alert("Pick a template", "Choose which note should auto-send.");
    if (!TIME_RE.test(settings.autoTime))
      return Alert.alert("Set a time", "Enter a valid time like 21:30.");
    if (settings.lat == null || settings.lng == null)
      return Alert.alert("Save your location", "Tap “Use my current location”.");
    setBusy(true);
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") return Alert.alert("Location needed");
      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.status !== "granted")
        return Alert.alert(
          "Set location to “Always”",
          "Background location is required to check where you are when the time hits.",
        );
      await upd({ autoEnabled: true });
      await startAutoSend();
      Alert.alert(
        "Armed",
        "When your time hits, if you're still at this spot, it sends automatically — even with the app closed.",
      );
    } catch (e) {
      Alert.alert("Couldn't arm", msg(e));
    } finally {
      setBusy(false);
    }
  }

  // ---------- render ----------
  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!app) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen}>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.brand}>LatePass</Text>
            <View style={styles.card}>
              <Text style={styles.h1}>Connect your Gmail</Text>
              <Text style={styles.p}>
                Sign in once with Google (send-only access). Your late note goes
                from your own address — set up templates and one-tap or automatic
                sending.
              </Text>
              <Btn label="Connect Gmail" onPress={connect} busy={busy} />
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const titles: Record<Screen, { title: string; sub: string }> = {
    home: { title: "Send", sub: "One tap from your own Gmail" },
    templates: { title: "Templates", sub: "Create and edit your notes" },
    auto: { title: "Auto-send", sub: "Send by location + time" },
    profile: { title: "Profile", sub: settings.fromEmail },
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <View style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <View style={styles.flexShrink}>
                <Text style={styles.screenTitle}>{titles[screen].title}</Text>
                <Text style={styles.screenSub} numberOfLines={1}>
                  {titles[screen].sub}
                </Text>
              </View>
              <View style={styles.brandRow}>
                <Image
                  source={require("./assets/icon.png")}
                  style={styles.brandLogo}
                />
                <Text style={styles.brand}>LatePass</Text>
              </View>
            </View>

            {screen === "home" ? (
              <HomeScreen
                app={app}
                sel={sendSel}
                onSel={setSendSel}
                onSend={doSend}
                fromEmail={settings.fromEmail}
              />
            ) : null}
            {screen === "templates" ? (
              <TemplatesScreen
                app={app}
                draft={draft}
                onSelect={(t) => setDraft({ ...t })}
                onPatch={patchDraft}
                onSave={saveDraft}
                onAdd={addTemplate}
                onDelete={removeTemplate}
                busy={busy}
              />
            ) : null}
            {screen === "auto" ? (
              <AutoScreen
                app={app}
                settings={settings}
                onUpd={upd}
                onCapture={captureLocation}
                onToggle={toggleAuto}
                onTest={async () => {
                  const r = await runAutoCheck({ ignoreEnabled: true });
                  const explain: Record<typeof r, string> = {
                    sent: "Sent ✓ — the rule matched and the mail went out.",
                    "skipped-disabled":
                      "Not armed, or no template/location set. Turn auto-send on and save a spot first.",
                    "skipped-time":
                      "It's before your set time. Set the time to a minute ago, then test again.",
                    "skipped-already":
                      "Already sent today — it only fires once per day.",
                    "skipped-location":
                      "Couldn't get a GPS fix. Check location permission.",
                    "skipped-away":
                      "You're not within the saved radius right now, so it won't send.",
                    failed:
                      "Rule matched but the send failed (network/login). Check your connection.",
                  };
                  Alert.alert("Auto-send check", explain[r] ?? r);
                }}
                busy={busy}
              />
            ) : null}
            {screen === "profile" ? (
              <ProfileScreen
                app={app}
                settings={settings}
                onSaveCap={saveCap}
                onSignOut={disconnect}
              />
            ) : null}
          </ScrollView>

          <View style={styles.tabbar}>
            <TabIcon icon="paper-plane" label="Send" active={screen === "home"} onPress={() => goTo("home")} />
            <TabIcon icon="documents" label="Templates" active={screen === "templates"} onPress={() => goTo("templates")} />
            <TabIcon icon="location" label="Auto" active={screen === "auto"} onPress={() => goTo("auto")} />
            <TabIcon icon="person" label="Profile" active={screen === "profile"} onPress={() => goTo("profile")} />
          </View>

          {toast ? (
            <Animated.View
              style={[styles.toast, { opacity: toastOpacity }]}
              pointerEvents="none"
            >
              <Text style={styles.toastText}>{toast}</Text>
            </Animated.View>
          ) : null}
        </View>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ---------- screens ----------

type SendPhase = "idle" | "confirm" | "sending" | "sent";

function HomeScreen({
  app,
  sel,
  onSel,
  onSend,
  fromEmail,
}: {
  app: AppState;
  sel: string;
  onSel: (id: string) => void;
  onSend: (id: string) => Promise<boolean>;
  fromEmail: string;
}) {
  const [phase, setPhase] = useState<SendPhase>("idle");
  const t = app.templates.find((x) => x.id === sel) ?? app.templates[0];

  // Switching template resets the flow back to the start.
  function select(id: string) {
    onSel(id);
    setPhase("idle");
  }

  async function confirmSend() {
    if (!t) return;
    setPhase("sending");
    const ok = await onSend(t.id);
    setPhase(ok ? "sent" : "idle");
  }

  if (!t)
    return (
      <View style={styles.card}>
        <Text style={styles.p}>No templates yet — add one in Templates.</Text>
      </View>
    );

  if (phase === "sent") {
    return (
      <View style={[styles.card, { alignItems: "center", paddingVertical: 36 }]}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={48} color="#000" />
        </View>
        <Text style={[styles.h1, { marginTop: 18, marginBottom: 4 }]}>Sent ✓</Text>
        <Text style={[styles.hint, { textAlign: "center" }]}>
          Your note is on its way.
        </Text>
        <View style={{ height: 22 }} />
        <Btn label="Send another" variant="secondary" onPress={() => setPhase("idle")} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.h1}>Send late-arrival note</Text>
      <Text style={styles.hint}>From {fromEmail}</Text>

      {app.templates.length > 1 ? (
        <View style={{ marginTop: 14 }}>
          <Chips items={app.templates} selected={t.id} onSelect={select} />
        </View>
      ) : null}

      <View style={styles.preview}>
        <PrevRow k="To" v={t.recipient} />
        {t.cc ? <PrevRow k="Cc" v={t.cc} /> : null}
        <PrevRow k="Subject" v={renderTemplate(t.subject, t)} />
        <PrevRow k="Date" v={todayLabel()} />
      </View>

      <Text style={styles.label}>Message preview</Text>
      <View style={styles.previewBody}>
        <Text style={styles.mono}>{renderTemplate(t.body, t)}</Text>
      </View>

      {phase === "confirm" ? (
        <View style={[styles.btnRow, { marginTop: 18 }]}>
          <View style={styles.btnHalf}>
            <Btn label="Cancel" variant="secondary" onPress={() => setPhase("idle")} />
          </View>
          <View style={styles.btnHalf}>
            <Btn label="Yes, send" onPress={confirmSend} flush />
          </View>
        </View>
      ) : (
        <Btn
          label={phase === "sending" ? "Sending…" : "Send now"}
          onPress={() => setPhase("confirm")}
          busy={phase === "sending"}
        />
      )}
    </View>
  );
}

function TemplatesScreen({
  app,
  draft,
  onSelect,
  onPatch,
  onSave,
  onAdd,
  onDelete,
  busy,
}: {
  app: AppState;
  draft: AppTemplate | null;
  onSelect: (t: AppTemplate) => void;
  onPatch: (p: Partial<AppTemplate>) => void;
  onSave: () => void;
  onAdd: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        {app.templates.map((x) => (
          <Pressable
            key={x.id}
            onPress={() => onSelect(x)}
            style={[styles.chip, draft?.id === x.id && styles.chipActive]}
          >
            <Text style={[styles.chipText, draft?.id === x.id && styles.chipTextActive]}>
              {x.label || "Untitled"}
            </Text>
          </Pressable>
        ))}
        {app.templates.length < app.maxTemplates ? (
          <Pressable onPress={onAdd} style={styles.chip}>
            <Text style={styles.chipText}>+ Add</Text>
          </Pressable>
        ) : null}
      </View>

      {draft ? (
        <>
          <Field label="Template name" value={draft.label} onChange={(v) => onPatch({ label: v })} />
          <Field label="Recipient email" value={draft.recipient} onChange={(v) => onPatch({ recipient: v })} />
          <SuggestRow options={RECIPIENT_OPTIONS} onPick={(v) => onPatch({ recipient: v })} />
          <Field label="CC (comma separated)" value={draft.cc ?? ""} onChange={(v) => onPatch({ cc: v })} />
          <SuggestRow
            options={CC_OPTIONS}
            prefix="+ "
            onPick={(v) => {
              const cur = (draft.cc ?? "").split(",").map((s) => s.trim()).filter(Boolean);
              if (!cur.includes(v)) onPatch({ cc: [...cur, v].join(", ") });
            }}
          />
          <Field label="Subject" value={draft.subject} onChange={(v) => onPatch({ subject: v })} />
          <Field label="Message" value={draft.body} onChange={(v) => onPatch({ body: v })} multiline />
          <Text style={styles.hint}>
            Placeholders: {"{name} {room} {roll} {arrivalTime} {reason} {date}"}
          </Text>

          <Text style={[styles.label, { marginTop: 18 }]}>Your details</Text>
          <Field label="Name {name}" value={draft.field_name} onChange={(v) => onPatch({ field_name: v })} />
          <Field label="Roll no. {roll}" value={draft.field_roll} onChange={(v) => onPatch({ field_roll: v })} />
          <Field label="Room {room}" value={draft.field_room} onChange={(v) => onPatch({ field_room: v })} />
          <Field
            label="Arrival time {arrivalTime}"
            value={draft.field_arrival_time}
            onChange={(v) => onPatch({ field_arrival_time: v })}
          />
          <Field label="Reason {reason}" value={draft.field_reason} onChange={(v) => onPatch({ field_reason: v })} />

          {/* Live preview */}
          <Text style={[styles.label, { marginTop: 18 }]}>Live preview</Text>
          <View style={styles.previewBody}>
            <Text style={styles.previewSubject}>
              {renderTemplate(draft.subject, draft) || "(subject)"}
            </Text>
            <Text style={styles.mono}>{renderTemplate(draft.body, draft)}</Text>
          </View>

          <Btn label="Save template" onPress={onSave} busy={busy} />
          {app.templates.length > 1 ? (
            <>
              <View style={{ height: 10 }} />
              <Btn label="Delete this template" variant="ghost" onPress={onDelete} busy={busy} />
            </>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function AutoScreen({
  app,
  settings,
  onUpd,
  onCapture,
  onToggle,
  onTest,
  busy,
}: {
  app: AppState;
  settings: Settings;
  onUpd: (p: Partial<Settings>) => void;
  onCapture: () => void;
  onToggle: (v: boolean) => void;
  onTest: () => void;
  busy: boolean;
}) {
  const hasLoc = settings.lat != null && settings.lng != null;
  return (
    <View style={styles.card}>
      <Text style={styles.p}>
        Pick a note, set a time, save your spot. When that time arrives, if
        you're still at this spot, it sends automatically — even with the app
        closed. (Checked every ~15 min, so it may send shortly after the time.)
      </Text>

      <Text style={styles.label}>Which note</Text>
      <Chips
        items={app.templates}
        selected={settings.autoTemplateId}
        onSelect={(id) => onUpd({ autoTemplateId: id })}
      />

      <TimeField
        label="Send at"
        value={settings.autoTime}
        onChange={(v) => onUpd({ autoTime: v })}
      />

      <Text style={[styles.label, { marginTop: 14 }]}>Your spot</Text>
      <Btn
        label={hasLoc ? "Update my location" : "Use my current location"}
        variant="secondary"
        onPress={onCapture}
        busy={busy}
      />
      <Text style={styles.hint}>
        {hasLoc
          ? `Saved: ${settings.lat!.toFixed(4)}, ${settings.lng!.toFixed(4)} · within ${settings.radius} m`
          : "Save this while standing at the spot (e.g. your office)."}
      </Text>
      <Field
        label="Trigger radius (m)"
        value={String(settings.radius)}
        keyboardType="number-pad"
        onChange={(v) => onUpd({ radius: Math.max(50, Math.min(2000, Number(v) || 150)) })}
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Auto-send enabled</Text>
        <Switch
          value={settings.autoEnabled}
          onValueChange={onToggle}
          trackColor={{ false: "#333", true: "#fff" }}
          thumbColor={settings.autoEnabled ? "#000" : "#fff"}
        />
      </View>

      <View style={{ height: 10 }} />
      <Btn label="Test the auto-send rule" variant="ghost" onPress={onTest} busy={busy} />
    </View>
  );
}

function ProfileScreen({
  app,
  settings,
  onSaveCap,
  onSignOut,
}: {
  app: AppState;
  settings: Settings;
  onSaveCap: (cap: number) => void;
  onSignOut: () => void;
}) {
  const [cap, setCap] = useState(String(app.dailyCap));
  const initial = (settings.fromEmail || "?").trim().charAt(0).toUpperCase();
  return (
    <>
      <View style={[styles.card, { alignItems: "center" }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.profileEmail}>{settings.fromEmail}</Text>
        <Text style={styles.hint}>Connected — sends from this address</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Daily send limit</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={cap}
            keyboardType="number-pad"
            onChangeText={setCap}
          />
          <Pressable
            style={styles.smallBtn}
            onPress={() => onSaveCap(Math.max(1, Math.min(50, Number(cap) || 1)))}
          >
            <Text style={styles.smallBtnText}>Save</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>Max sends per day across all templates.</Text>
      </View>

      <View style={styles.card}>
        <Btn
          label="Open web manager"
          variant="secondary"
          onPress={() => Linking.openURL(`${BASE}/manage/${settings.manageToken}`)}
        />
        <View style={{ height: 10 }} />
        <Btn label="Sign out" variant="ghost" onPress={onSignOut} />
        <Text style={[styles.hint, { textAlign: "center", marginTop: 14 }]}>
          LatePass · {app.templates.length}/{app.maxTemplates} templates
        </Text>
      </View>
    </>
  );
}

// ---------- small components ----------

function TabIcon({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const color = active ? "#fff" : "rgba(255,255,255,0.45)";
  return (
    <Pressable style={styles.tab} onPress={onPress}>
      <Ionicons name={active ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Chips({
  items,
  selected,
  onSelect,
}: {
  items: { id: string; label: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.row}>
      {items.map((it) => (
        <Pressable
          key={it.id}
          onPress={() => onSelect(it.id)}
          style={[styles.chip, selected === it.id && styles.chipActive]}
        >
          <Text style={[styles.chipText, selected === it.id && styles.chipTextActive]}>
            {it.label || "Untitled"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function SuggestRow({
  options,
  onPick,
  prefix = "",
}: {
  options: string[];
  onPick: (v: string) => void;
  prefix?: string;
}) {
  return (
    <View style={[styles.row, { marginTop: 8 }]}>
      {options.map((o) => (
        <Pressable key={o} onPress={() => onPick(o)} style={styles.chip}>
          <Text style={styles.chipText}>
            {prefix}
            {o}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "number-pad";
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize="none"
        placeholderTextColor="#666"
      />
    </View>
  );
}

function hhmmToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

function dateToHhmm(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

/** 24h "HH:MM" → friendly "9:30 PM". */
function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = (h || 0) < 12 ? "AM" : "PM";
  const h12 = (h || 0) % 12 || 12;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}

/** Tap to open the native time picker; stores the result as "HH:MM". */
function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.input} onPress={() => setOpen(true)}>
        <Text style={styles.timeValue}>{prettyTime(value)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={hhmmToDate(value)}
          mode="time"
          is24Hour={false}
          onChange={(event, selected) => {
            setOpen(false);
            if (event.type === "set" && selected) onChange(dateToHhmm(selected));
          }}
        />
      ) : null}
    </View>
  );
}

function PrevRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.prevRow}>
      <Text style={styles.prevK}>{k}</Text>
      <Text style={styles.prevV}>{v}</Text>
    </View>
  );
}

function Btn({
  label,
  onPress,
  busy,
  variant = "primary",
  flush,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  flush?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        variant === "secondary" && styles.btnSecondary,
        variant === "ghost" && styles.btnGhost,
        flush && { marginTop: 0 },
        (pressed || busy) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.btnText, variant !== "primary" && styles.btnTextLight]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#000" },
  flex: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  content: { padding: 18, paddingBottom: 28, gap: 14 },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  flexShrink: { flexShrink: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandLogo: { width: 26, height: 26, borderRadius: 7 },
  brand: { color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: "700" },
  screenTitle: { color: "#fff", fontSize: 28, fontWeight: "700", letterSpacing: -0.5 },
  screenSub: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginTop: 2 },
  card: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
  },
  h1: { color: "#fff", fontSize: 22, fontWeight: "700", marginBottom: 8 },
  p: { color: "rgba(255,255,255,0.62)", fontSize: 14, lineHeight: 20, marginBottom: 14 },
  label: { color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: "600", marginBottom: 7 },
  hint: { color: "rgba(255,255,255,0.4)", fontSize: 12.5, marginTop: 7 },
  input: {
    color: "#fff",
    fontSize: 15,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputMultiline: { minHeight: 120, textAlignVertical: "top" },
  timeValue: { color: "#fff", fontSize: 15 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
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
  preview: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginVertical: 16,
  },
  prevRow: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  prevK: { color: "rgba(255,255,255,0.4)", fontSize: 13, width: 64 },
  prevV: { color: "#fff", fontSize: 13, flex: 1 },
  previewBody: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 7,
  },
  previewSubject: { color: "#fff", fontWeight: "700", fontSize: 14, marginBottom: 8 },
  mono: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: undefined,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 20,
  },
  toggleLabel: { color: "#fff", fontSize: 15, fontWeight: "600" },
  toast: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 86,
    backgroundColor: "rgba(245,245,250,0.97)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  toastText: { color: "#16161c", fontSize: 14, fontWeight: "600" },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#000", fontSize: 28, fontWeight: "700" },
  profileEmail: { color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
  btnRow: { flexDirection: "row", gap: 10 },
  btnHalf: { flex: 1 },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  smallBtn: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  smallBtnText: { color: "#000", fontWeight: "700" },
  btn: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 18,
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
  tabbar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(10,10,10,0.96)",
    paddingTop: 8,
    paddingBottom: 6,
  },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingVertical: 4 },
  tabLabel: { fontSize: 11, fontWeight: "600" },
});
