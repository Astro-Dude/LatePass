# LatePass

One-tap "late arrival" email, sent from each student's **own Gmail** account.
Set it up once, add the link to your phone's home screen, and a single tap sends
a pre-written note to the warden — no opening Gmail, no typing.

- Per-user Google OAuth, **`gmail.send` scope only** (no inbox read access).
- Fully editable template with `{name} {room} {roll} {arrivalTime} {reason} {date}`.
- Real PWA (`/t/{token}`) — installs to the home screen on iOS Safari & Android Chrome.
- Refresh tokens encrypted at rest (AES-256-GCM), per-token daily cap, send logging.
- Sending layer is swappable behind one interface (drop in Nylas/Unipile later).

---

## Part 1 — Google Cloud setup (do this first)

You'll create an OAuth client and put the app in **Testing** mode (fine for ≤100
users). Each student must be added as a test user.

### 1. Create / pick a project
1. Go to <https://console.cloud.google.com/>.
2. Top bar → project dropdown → **New Project** (e.g. "LatePass"). Select it.

### 2. Enable the Gmail API
1. <https://console.cloud.google.com/apis/library> → search **Gmail API** → **Enable**.

### 3. Configure the OAuth consent screen
1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → Create.
3. App name **LatePass**, your support email, developer contact email. Save.
4. **Scopes** step → **Add or remove scopes** → manually add:
   ```
   https://www.googleapis.com/auth/gmail.send
   ```
   (Do **not** add any read/modify scopes.) The `openid` and
   `.../auth/userinfo.email` scopes are basic sign-in scopes; add `userinfo.email`
   too so the app can read which account connected. Save.
5. **Test users** step → **Add users** → add each student's Gmail address.
   Re-visit here whenever you onboard someone new. Save.
6. Leave **Publishing status = Testing**.

> Test mode means refresh tokens can expire after 7 days of the app being in
> "testing". For ~50 known users this is usually fine; if a student's link stops
> sending, they just tap **Connect my Gmail** again to refresh it.

### 4. Create the OAuth client (Client ID + Secret)
1. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
2. Application type: **Web application**. Name it "LatePass Web".
3. **Authorized redirect URIs** — add both:
   ```
   http://localhost:3000/api/auth/google/callback
   https://YOUR-APP.vercel.app/api/auth/google/callback
   ```
4. **Create** → copy the **Client ID** and **Client secret**.

You now have everything for the env vars below.

---

## Part 2 — Database

Use any hosted Postgres. Two easy options:

- **Neon** (<https://neon.tech>): create a project, copy the **pooled** connection
  string (ends with `?sslmode=require`).
- **Supabase** (<https://supabase.com>): Project → Database → **Connection string**
  → use the **Transaction pooler** (port 6543) string.

Then create the tables — run the contents of [`db/schema.sql`](db/schema.sql) once
in the provider's SQL editor (or `psql "$DATABASE_URL" -f db/schema.sql`).

---

## Part 3 — Local setup

```bash
npm install

# generate a 32-byte encryption key
npm run keygen        # prints a base64 key

cp .env.example .env.local   # then fill in the values
npm run icons         # (optional) regenerate PWA icons
npm run dev           # http://localhost:3000
```

`.env.local` values:

| Var | What |
| --- | --- |
| `APP_BASE_URL` | `http://localhost:3000` locally; your Vercel URL in prod |
| `APP_TIMEZONE` | `Asia/Kolkata` (drives `{date}` + daily-cap reset) |
| `DATABASE_URL` | Postgres connection string (SSL) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | from Part 1 step 4 |
| `GOOGLE_REDIRECT_URI` | `<APP_BASE_URL>/api/auth/google/callback` |
| `ENCRYPTION_KEY` | output of `npm run keygen` |

---

## Part 4 — How it works (the flow)

1. **`/`** → "Connect my Gmail" → Google OAuth (`gmail.send`, `prompt=consent`).
2. **`/api/auth/google/callback`** → exchanges the code, reads the user's email,
   encrypts the refresh token, upserts a config row, and redirects to…
3. **`/manage/{manageToken}`** → private setup/edit page. Fill recipient, CC,
   subject, template, the field values, daily cap. Shows the send link + install help.
4. **`/t/{sendToken}`** → the PWA. "Add to Home Screen", then tap → confirm → send.
5. **`/api/send`** → enforces the daily cap, renders the template with a fresh
   `{date}`, sends via the student's Gmail, logs the attempt.

Two tokens guard each config:
- `send_token` — the home-screen link; can only trigger a send.
- `manage_token` — the private edit link; edits config and can regenerate the
  send token (which invalidates the old home-screen icon).

---

## Part 5 — Deploy to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add all env vars from the table above in **Project → Settings → Environment
   Variables**. Set `APP_BASE_URL` and `GOOGLE_REDIRECT_URI` to your real
   `https://YOUR-APP.vercel.app` domain.
3. Make sure that exact callback URL is in the Google OAuth client's
   **Authorized redirect URIs** (Part 1 step 4).
4. Deploy. Run `db/schema.sql` against your production database once.

---

## Verifying end-to-end

1. `/` → Connect my Gmail → consent → you land on `/manage/...`.
2. Confirm a row exists: `select user_email, send_token from configs;` and that
   `encrypted_credential` is an opaque base64 blob (not the raw token).
3. Fill the form, Save, open the send link, tap **Send now** → confirm → "Sent ✓".
   Check the warden inbox: the mail is **from the student**, `Reply-To` is the
   student, and `{date}` reads like "Wednesday, June 14, 2026".
4. `select * from send_logs;` shows a `sent` row.
5. Send past the daily cap → blocked with a friendly message (logged as `capped`).
6. Regenerate the token on the manage page → the old `/t/...` link now 404s.

---

## Automatic, location-based send

The web app is **manual send only** (open the link → tap → sent). Hands-off,
location-gated auto-send ("send automatically when I arrive at the hostel after
my set time, even with the app closed") lives in the **native app** — see
[`mobile/`](mobile/). It reuses this backend via the read-only
`GET /api/send/info` and the existing `POST /api/send` endpoints; nothing else
is needed server-side.

## Swapping the sending provider later

Everything Gmail-specific lives behind `EmailSender`
([`src/lib/email/types.ts`](src/lib/email/types.ts)). To migrate to a pre-verified
provider when you outgrow Google's 100-test-user limit:

1. Add `src/lib/email/nylas.ts` implementing `EmailSender`.
2. Return it from `getSender()` in [`src/lib/email/index.ts`](src/lib/email/index.ts).

`getSender()` is the **only** place coupled to Gmail; no call sites change. The
stored `provider` column on each config selects the backend, and
`encrypted_credential` holds whatever secret that backend needs.

---

## Project layout

```
src/lib/            crypto, db, env, google OAuth, template, config queries
src/lib/email/      EmailSender interface + GmailSender + factory
src/app/            landing, manage page, /t/{token} PWA, API routes
src/app/t/[token]/manifest.webmanifest/  per-token PWA manifest
db/schema.sql       tables
scripts/generate-icons.mjs  dependency-free PNG icon generator
```

## Notes
- `npm run build` reports 2 moderate, build-time-only transitive advisories inside
  Next.js's own toolchain (PostCSS stringify); they don't affect runtime and the
  only "fix" npm offers is downgrading Next to v9. Left as-is intentionally.
