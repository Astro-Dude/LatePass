import { NextResponse, type NextRequest } from "next/server";
import { createTemplate, getByManageToken } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ manageToken: string }> };

/** POST: add a new template (max 3). */
export async function POST(_req: NextRequest, { params }: Params) {
  const { manageToken } = await params;
  const config = await getByManageToken(manageToken);
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const template = await createTemplate(config.id);
  if (!template) {
    return NextResponse.json(
      { error: "You can have at most 3 templates." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true, template });
}
