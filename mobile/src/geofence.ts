import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";
import { sendNow } from "./api";
import { getSettings, patchSettings } from "./storage";

export const GEOFENCE_TASK = "latepass-geofence";

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function todayStr(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(
    n.getDate(),
  ).padStart(2, "0")}`;
}

async function notify(body: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: "LatePass", body },
      trigger: null,
    });
  } catch {
    /* notifications optional */
  }
}

/**
 * The combined rule: fire only when ALL hold —
 *  - auto-send is enabled and configured
 *  - it's at/after the set time (local)
 *  - we haven't already sent today
 * Called on geofence ENTER (background) and can be called manually on app open.
 */
export async function maybeAutoSend(): Promise<
  "sent" | "skipped-disabled" | "skipped-time" | "skipped-already" | "failed"
> {
  const s = await getSettings();
  if (!s.enabled || !s.token || !s.templateId) return "skipped-disabled";

  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < hhmmToMinutes(s.time)) return "skipped-time";

  const today = todayStr();
  if (s.lastSent === today) return "skipped-already";

  try {
    await sendNow(s.token, s.templateId);
    await patchSettings({ lastSent: today });
    await notify("Late note sent ✓ — you're covered.");
    return "sent";
  } catch (e) {
    await notify(
      `Auto-send failed: ${e instanceof Error ? e.message : "error"}. Open the app to send.`,
    );
    return "failed";
  }
}

// Background task: wakes the app when the user ENTERS the saved region.
TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) return;
  const { eventType } = (data ?? {}) as {
    eventType?: Location.GeofencingEventType;
  };
  if (eventType === Location.GeofencingEventType.Enter) {
    await maybeAutoSend();
  }
});

export async function isGeofenceRunning(): Promise<boolean> {
  try {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
  } catch {
    return false;
  }
}

export async function startGeofence(
  lat: number,
  lng: number,
  radius: number,
): Promise<void> {
  await stopGeofence();
  await Location.startGeofencingAsync(GEOFENCE_TASK, [
    {
      identifier: "home",
      latitude: lat,
      longitude: lng,
      radius,
      notifyOnEnter: true,
      notifyOnExit: false,
    },
  ]);
}

export async function stopGeofence(): Promise<void> {
  if (await isGeofenceRunning()) {
    await Location.stopGeofencingAsync(GEOFENCE_TASK);
  }
}
