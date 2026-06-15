import { NextResponse, type NextRequest } from "next/server";
import { getByManageToken, getRecentAutoChecks } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * View the recent background auto-send heartbeats for this account. Open
 * /api/autocheck/{manageToken} in a browser to confirm the task is firing and
 * see what it decided each run.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ manageToken: string }> },
) {
  const { manageToken } = await params;
  const config = await getByManageToken(manageToken);
  if (!config) return NextResponse.json({ error: "Unknown token." }, { status: 404 });

  const checks = await getRecentAutoChecks(config.id, 30);
  return NextResponse.json({
    email: config.user_email,
    count: checks.length,
    lastCheckedAt: checks[0]?.at ?? null,
    checks,
  });
}
