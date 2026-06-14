import { cookies } from "next/headers";
import { getByManageToken } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Returning user? Look up their persisted session.
  const session = (await cookies()).get("lp_session")?.value;
  const config = session ? await getByManageToken(session) : null;

  return (
    <main className="page center">
      <div className="shell">
        <div className="brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="LatePass" />
          LatePass
        </div>

        {error ? <div className="banner error">{error}</div> : null}

        {config ? (
          <WelcomeBack
            email={config.user_email}
            manageToken={config.manage_token}
          />
        ) : (
          <ConnectCard />
        )}

        <div className="card">
          <p className="section-label">How it works</p>
          <ol className="steps">
            <li>Connect your Gmail (send-only access).</li>
            <li>Fill in your details and the message — all editable.</li>
            <li>Add the personal link to your phone&apos;s home screen.</li>
            <li>Tap the icon → confirm → sent from your own address. ✓</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

function WelcomeBack({
  email,
  manageToken,
}: {
  email: string;
  manageToken: string;
}) {
  return (
    <div className="card">
      <h1>Welcome back.</h1>
      <p>
        You&apos;re connected as <strong>{email}</strong>. Pick up right where you
        left off.
      </p>
      <a className="btn" href={`/manage/${manageToken}`}>
        Open my LatePass
      </a>
      <div className="btn-row stack" style={{ marginTop: 10 }}>
        <a className="btn ghost" href="/api/auth/google">
          Switch account
        </a>
        <a className="btn ghost" href="/api/auth/logout">
          Log out
        </a>
      </div>
    </div>
  );
}

function ConnectCard() {
  return (
    <div className="card">
      <h1>One tap. You&apos;re covered.</h1>
      <p>
        Send your &ldquo;running late&rdquo; note to the warden straight from your
        own Gmail — no typing, no opening the app. Set it up once, add it to your
        home screen, and it&apos;s a single tap from then on.
      </p>

      <a className="btn btn-google" href="/api/auth/google">
        <span className="g">G</span>
        Connect my Gmail
      </a>

      <p className="hint" style={{ marginTop: 14 }}>
        We only ask for permission to <strong>send</strong> email on your behalf —
        never to read your inbox. You can disconnect anytime from your Google
        account.
      </p>
    </div>
  );
}
