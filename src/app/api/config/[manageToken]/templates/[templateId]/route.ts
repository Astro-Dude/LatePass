import { NextResponse, type NextRequest } from "next/server";
import {
  deleteTemplate,
  getByManageToken,
  updateTemplate,
} from "@/lib/config";
import { parseTemplate } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ manageToken: string; templateId: string }> };

/** PUT: edit a template (manage-token auth). */
export async function PUT(req: NextRequest, { params }: Params) {
  const { manageToken, templateId } = await params;
  const config = await getByManageToken(manageToken);
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const data = parseTemplate(body);
  if ("error" in data) {
    return NextResponse.json({ error: data.error }, { status: 400 });
  }

  const updated = await updateTemplate(config.id, templateId, data);
  if (!updated) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  return NextResponse.json({ ok: true, template: updated });
}

/** DELETE: remove a template (never the last one). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { manageToken, templateId } = await params;
  const config = await getByManageToken(manageToken);
  if (!config) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const ok = await deleteTemplate(config.id, templateId);
  if (!ok) {
    return NextResponse.json(
      { error: "Can't delete your only template." },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
