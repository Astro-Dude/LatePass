# LatePass — mobile app

A thin native app (Expo / React Native) that does the one thing the web app
can't: **auto-send your late note when you physically arrive at your saved spot,
after your set time — even with the app closed.**

It reuses the existing LatePass backend. You connect it with your `/t/{token}`
send link; when you enter your saved region it calls the same `/api/send`.

## How the trigger works (read this)

Phones do **not** let an app reliably run at an exact clock time in the
background — but they **do** wake an app when you **enter a geofenced region**,
even when it's killed. So the rule is:

> When you **enter your saved location** **and** it's **at/after your set time**
> **and** you **haven't already sent today** → send automatically.

That matches the real situation (you send *because* you just got back late). It
is not "fire at exactly 23:00 regardless" — that's not possible in the
background.

Requirements:
- **"Always" location permission** (background). The OS will ask; the user must
  choose Always, not "While Using".
- A **development/standalone build** — background geofencing does **not** work in
  Expo Go.

## Setup

```bash
cd mobile
npm install
npx expo install --fix      # align native module versions to the Expo SDK
```

Set your API URL if different from the default in `app.json` →
`expo.extra.apiBaseUrl` (currently `https://latepass-sage.vercel.app`).

## Run on a device (EAS dev build)

You need an [Expo account](https://expo.dev) and the EAS CLI:

```bash
npm i -g eas-cli
eas login
eas build:configure
```

**Android** (easiest — no paid account):
```bash
eas build --profile development --platform android
# install the resulting .apk on your phone, then:
npx expo start --dev-client
```

**iOS** (needs an Apple Developer account, $99/yr, for a device build):
```bash
eas build --profile development --platform ios
# install via the EAS link / TestFlight, then:
npx expo start --dev-client
```

Local alternative if you have Xcode/Android Studio: `npm run ios` / `npm run android`.

## Using it

1. Open the app → paste your LatePass send link → **Connect**.
2. Pick a template, set **Send after** (e.g. `21:30`).
3. Stand at the hostel → **Use my current location**.
4. Flip **Auto-send enabled** → grant location **Always**.
5. Done. Walk in late → it sends and you get a "Sent ✓" notification.

Buttons: **Send now** (manual), **Test the auto-send rule** (runs the
enabled/time/already-sent check immediately and tells you the result), and
**Disconnect**.

## Notes / limits
- Daily cap and send logging are still enforced server-side (same backend).
- Geofence entry detection can take a minute and has ~50–150 m accuracy — set a
  sensible radius (default 150 m).
- iOS may batch/delay background wakeups; arrival is reliable but not instant.
- The token is stored on-device (AsyncStorage) so the background task can use it.
