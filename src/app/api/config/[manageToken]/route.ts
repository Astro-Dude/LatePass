import { NextResponse, type NextRequest } from "next/server";
import {
  getByManageToken,
  regenerateSendToken,
  setDailyCap,
} from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ manageToken: string }> };

/** PUT: config-level settings (daily cap). */
export async function PUT(req: NextRequest, { params }: Params) {
  const { manageToken } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  let dailyCap = Number(body.daily_cap);
  if (!Number.isFinite(dailyCap)) dailyCap = 1;
  dailyCap = Math.min(50, Math.max(1, Math.floor(dailyCap)));

  const ok = await setDailyCap(manageToken, dailyCap);
  if (!ok) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ ok: true, daily_cap: dailyCap });
}

/** POST: regenerate the send token (invalidates the old home-screen link). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { manageToken } = await params;
  const exists = await getByManageToken(manageToken);
  if (!exists) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const sendToken = await regenerateSendToken(manageToken);
  return NextResponse.json({ ok: true, sendToken });
}
