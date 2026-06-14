import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Per-token PWA manifest. `start_url` and `scope` point at this user's send
 * page, so when Android Chrome installs the app the home-screen icon reopens
 * /t/{token} directly (iOS Safari uses the page URL + apple-touch-icon instead).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const start = `/t/${token}`;

  const manifest = {
    name: "LatePass",
    short_name: "LatePass",
    description: "One-tap late-arrival notification from your own Gmail.",
    start_url: start,
    scope: start,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "portrait",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
