import { NextResponse, type NextRequest } from "next/server";
import { getBySendToken, getTemplates } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Read-only template list for a send token. Used by the native app to show
 * which template will be sent. Token-gated; never returns credentials.
 */
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const config = await getBySendToken(token);
  if (!config) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const templates = await getTemplates(config.id);
  return NextResponse.json({
    fromEmail: config.user_email,
    templates: templates.map((t) => ({
      id: t.id,
      label: t.label,
      recipient: t.recipient,
      cc: t.cc,
      subject: t.subject,
    })),
  });
}
