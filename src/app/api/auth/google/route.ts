import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start the OAuth flow. We generate a random `state`, stash it in a short-lived
 * HttpOnly cookie, and redirect to Google. The callback verifies it (CSRF).
 */
export async function GET() {
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("lp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });
  return res;
}
