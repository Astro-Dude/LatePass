import { NextResponse, type NextRequest } from "next/server";
import { exchangeCode } from "@/lib/google";
import { upsertAfterOAuth } from "@/lib/config";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * OAuth callback. Validates CSRF state, exchanges the code, stores the
 * encrypted refresh token keyed to a fresh config, and redirects to the
 * student's private manage page.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return redirectWithError(`Google sign-in was cancelled (${oauthError}).`);
  }

  const cookieState = req.cookies.get("lp_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    return redirectWithError("Invalid or expired sign-in attempt. Try again.");
  }

  try {
    const { refreshToken, email } = await exchangeCode(code);
    const { manageToken } = await upsertAfterOAuth(email, refreshToken);

    const res = NextResponse.redirect(
      `${env.appBaseUrl}/manage/${manageToken}`,
    );
    res.cookies.delete("lp_oauth_state");
    // Persist the logged-in state so returning users skip OAuth and land on
    // their manage page. httpOnly so client JS can't read the manage token.
    res.cookies.set("lp_session", manageToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 90, // 90 days
    });
    return res;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not connect your Gmail.";
    return redirectWithError(message);
  }
}

function redirectWithError(message: string) {
  const url = new URL(`${env.appBaseUrl}/`);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url.toString());
}
