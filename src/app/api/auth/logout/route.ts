import { NextResponse } from "next/server";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clear the persisted session and return to the landing page. */
export async function GET() {
  const res = NextResponse.redirect(`${env.appBaseUrl}/`);
  res.cookies.delete("lp_session");
  return res;
}
