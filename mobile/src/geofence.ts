import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import { sendNow, pingAutoCheck } from "./api";
import { getSettings, patchSettings } from "./storage";

export const AUTOSEND_TASK = "latepass-autosend";

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

/** Great-circle distance in metres between two coordinates. */
function distanceMeters(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s1 = toRad(aLat);
  const s2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(s1) * Math.cos(s2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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

export type AutoSendResult =
  | "sent"
  | "skipped-disabled"
  | "skipped-time"
  | "skipped-already"
  | "skipped-location"
  | "skipped-away"
  | "failed";

/**
 * Send only when ALL hold: auto-send is on, a template is chosen, it's at/after
 * the set time today, we haven't already sent today, and — crucially — you are
 * *currently* at the saved spot. The location is checked live at decision time
 * (not on arrival), so e.g. still being at your internship office when the time
 * hits is what triggers it. Run periodically by the background task, and can be
 * run manually to test.
 */
export async function maybeAutoSend(opts?: {
  ignoreEnabled?: boolean;
}): Promise<AutoSendResult> {
  const s = await getSettings();
  const enabledOk = opts?.ignoreEnabled || s.autoEnabled;
  if (
    !enabledOk ||
    !s.sendToken ||
    !s.autoTemplateId ||
    s.lat == null ||
    s.lng == null
  )
    return "skipped-disabled";

  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < hhmmToMinutes(s.autoTime))
    return "skipped-time";

  const today = todayStr();
  if (s.lastSent === today) return "skipped-already";

  // Are we actually at the saved location right now? If we can't get a fix,
  // don't send — we won't guess.
  let pos: Location.LocationObject;
  try {
    pos = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
  } catch {
    return "skipped-location";
  }
  const dist = distanceMeters(
    pos.coords.latitude,
    pos.coords.longitude,
    s.lat,
    s.lng,
  );
  if (dist > s.radius) return "skipped-away";

  try {
    await sendNow(s.sendToken, s.autoTemplateId);
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

/**
 * Run the rule and report the outcome to the backend (a heartbeat), so firing
 * can be observed server-side even when the app is closed. Use this from the
 * background task and the manual test.
 */
export async function runAutoCheck(opts?: {
  ignoreEnabled?: boolean;
}): Promise<AutoSendResult> {
  let result: AutoSendResult = "failed";
  try {
    result = await maybeAutoSend(opts);
  } catch {
    /* leave result = "failed" */
  }
  try {
    const s = await getSettings();
    if (s.sendToken) await pingAutoCheck(s.sendToken, result);
  } catch {
    /* heartbeat is best-effort */
  }
  return result;
}

// Background task: the OS wakes it periodically (~every 15 min, inexact). Each
// run re-checks the rule, so once the clock passes your time and you're at the
// spot, the next wake-up sends it — even with the app closed.
TaskManager.defineTask(AUTOSEND_TASK, async () => {
  await runAutoCheck();
  return BackgroundTask.BackgroundTaskResult.Success;
});

export async function isAutoSendRunning(): Promise<boolean> {
  try {
    return await TaskManager.isTaskRegisteredAsync(AUTOSEND_TASK);
  } catch {
    return false;
  }
}

export async function startAutoSend(): Promise<void> {
  await stopAutoSend();
  await BackgroundTask.registerTaskAsync(AUTOSEND_TASK, { minimumInterval: 15 });
}

export async function stopAutoSend(): Promise<void> {
  if (await isAutoSendRunning()) {
    await BackgroundTask.unregisterTaskAsync(AUTOSEND_TASK);
  }
}
