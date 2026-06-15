import { NextResponse, type NextRequest } from "next/server";
import { getBySendToken, logAutoCheck } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Heartbeat from the mobile background auto-send task. Records that the task
 * fired and what it decided (sent / skipped-away / etc.) so firing can be
 * observed server-side, even when the app is closed. Keyed by the send token.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; result?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const token = (body.token || "").trim();
  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });

  const config = await getBySendToken(token);
  if (!config) return NextResponse.json({ error: "Unknown token." }, { status: 404 });

  await logAutoCheck(config.id, String(body.result ?? "ran"));
  return NextResponse.json({ ok: true });
}
