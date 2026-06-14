import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBySendToken, getTemplates } from "@/lib/config";
import { formatDate } from "@/lib/template";
import { toDraft } from "@/lib/templateDraft";
import SendApp from "./SendApp";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  // Point each home-screen install at THIS user's per-token manifest.
  return {
    title: "LatePass — Send",
    manifest: `/t/${token}/manifest.webmanifest`,
  };
}

export default async function SendPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const config = await getBySendToken(token);
  if (!config) notFound();

  const templates = await getTemplates(config.id);

  return (
    <main className="page center">
      <div className="shell" style={{ maxWidth: 460 }}>
        <div className="card send-card">
          <div
            className="brand"
            style={{ justifyContent: "center", marginBottom: 18 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="brand-logo" src="/logo.png" alt="LatePass" />
            LatePass
          </div>

          <SendApp
            token={token}
            fromEmail={config.user_email}
            today={formatDate()}
            initialTemplates={templates.map(toDraft)}
          />
        </div>

        <p className="footer-note">Tap to send from your own Gmail.</p>
      </div>
    </main>
  );
}
