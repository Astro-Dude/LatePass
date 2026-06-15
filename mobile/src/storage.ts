import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Persisted settings (AsyncStorage so the background geofence task can read it
 * when the app is killed).
 *  - manageToken: full account access (template CRUD)
 *  - sendToken: used to actually send
 *  - auto*: the location auto-send config (which template, time, geofence)
 */
export interface Settings {
  manageToken: string;
  sendToken: string;
  fromEmail: string;

  autoEnabled: boolean;
  autoTemplateId: string;
  autoTime: string; // "HH:MM" local
  lat: number | null;
  lng: number | null;
  radius: number; // metres
  lastSent: string | null; // "YYYY-MM-DD"
}

const KEY = "latepass.settings.v2";

export const DEFAULT_SETTINGS: Settings = {
  manageToken: "",
  sendToken: "",
  fromEmail: "",
  autoEnabled: false,
  autoTemplateId: "",
  autoTime: "21:00",
  lat: null,
  lng: null,
  radius: 150,
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

export async function patchSettings(
  patch: Partial<Settings>,
): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await saveSettings(next);
  return next;
}
