import { cookies } from "next/headers";
import { getByManageToken } from "@/lib/config";
import Navbar from "@/components/Navbar";
import ProfileMenu from "@/components/ProfileMenu";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const session = (await cookies()).get("lp_session")?.value;
  const config = session ? await getByManageToken(session) : null;

  return (
    <>
      <Navbar
        right={
          config ? (
            <ProfileMenu
              email={config.user_email}
              name={config.display_name}
              avatarUrl={config.avatar_url}
              items={[
                {
                  label: "Open LatePass",
                  icon: "↗",
                  href: `/manage/${config.manage_token}`,
                },
                {
                  label: "Log out",
                  icon: "⤶",
                  href: "/api/auth/logout",
                  danger: true,
                },
              ]}
            />
          ) : (
            <>
              <a className="nav-btn" href="/api/auth/google">
                Login
              </a>
              <a className="nav-btn primary" href="/api/auth/google">
                Get started
              </a>
            </>
          )
        }
      />

      <main className="page center">
        <div className="shell">
          {error ? <div className="banner error">{error}</div> : null}

          {config ? (
            <div className="card">
              <h1>Welcome back.</h1>
              <p>
                You&apos;re connected as <strong>{config.user_email}</strong>.
                Pick up where you left off.
              </p>
              <a className="btn" href={`/manage/${config.manage_token}`}>
                Open my LatePass
              </a>
            </div>
          ) : (
            <div className="card">
              <h1>One tap. You&apos;re covered.</h1>
              <p>
                Fire off your &ldquo;running late&rdquo; note to the warden
                straight from your own Gmail — no typing, no opening the app. Set
                it up once, add it to your home screen, done.
              </p>
              <a className="btn btn-google" href="/api/auth/google">
                <span className="g">G</span>
                Connect my Gmail
              </a>
              <p className="hint" style={{ marginTop: 14 }}>
                We only ask to <strong>send</strong> email on your behalf — never
                to read your inbox.
              </p>
            </div>
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
    </>
  );
}
