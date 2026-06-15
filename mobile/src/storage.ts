import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persisted settings. Kept in AsyncStorage (not SecureStore) so the background
 * geofence task can read it reliably when the app is killed.
 */
export interface Settings {
  token: string;
  templateId: string;
  templateLabel: string;
  fromEmail: string;
  /** "HH:MM" 24h, local device time. Auto-send only fires at/after this. */
  time: string;
  lat: number | null;
  lng: number | null;
  radius: number; // metres
  enabled: boolean;
  /** "YYYY-MM-DD" of the last auto-send, to avoid repeats in a day. */
  lastSent: string | null;
}

const KEY = "latepass.settings";

export const DEFAULT_SETTINGS: Settings = {
  token: "",
  templateId: "",
  templateLabel: "",
  fromEmail: "",
  time: "21:00",
  lat: null,
  lng: null,
  radius: 150,
  enabled: false,
  lastSent: null,
};

export async function getSettings(): Promise<Settings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export async function patchSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await saveSettings(next);
  return next;
}
