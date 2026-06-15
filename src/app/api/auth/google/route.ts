import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { buildAuthUrl, isAppReturnUri } from "@/lib/google";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Start the OAuth flow. Generates a random `state` (CSRF) in an HttpOnly cookie
 * and redirects to Google. If a native-app `return` deep link is supplied, it's
 * remembered so the callback can hand the app its token.
 */
export async function GET(req: NextRequest) {
  const ret = new URL(req.url).searchParams.get("return") || "";

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(buildAuthUrl(state));
  res.cookies.set("lp_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  if (ret && isAppReturnUri(ret)) {
    res.cookies.set("lp_oauth_return", ret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  return res;
}
