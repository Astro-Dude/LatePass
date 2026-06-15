import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { BASE } from "./api";

// Required so the auth session can complete/redirect cleanly.
WebBrowser.maybeCompleteAuthSession();

/**
 * Run the same Google OAuth the website uses, inside an in-app browser. The
 * backend bounces back to our deep link (latepass://auth?token=…) and we return
 * the send token. No copy-pasting links.
 */
export async function loginWithGoogle(): Promise<string> {
  const redirectUri = Linking.createURL("auth"); // e.g. latepass://auth
  const authUrl = `${BASE}/api/auth/google?return=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (result.type === "cancel" || result.type === "dismiss") {
    throw new Error("Sign-in cancelled.");
  }
  if (result.type !== "success" || !result.url) {
    throw new Error("Sign-in didn't complete. Try again.");
  }

  const { queryParams } = Linking.parse(result.url);
  const token = queryParams?.token;
  if (typeof token !== "string" || !token) {
    const err = queryParams?.error;
    throw new Error(
      typeof err === "string" ? err : "No token returned from sign-in.",
    );
  }
  return token;
}
