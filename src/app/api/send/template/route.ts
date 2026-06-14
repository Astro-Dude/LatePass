import { NextResponse, type NextRequest } from "next/server";
import { getBySendToken, updateTemplate } from "@/lib/config";
import { parseTemplate } from "@/lib/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Save edits to a template from the send page (send-token auth). Lets a student
 * customise + save a template's content before sending, straight from their
 * home-screen link.
 */
export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const templateId =
    typeof body.templateId === "string" ? body.templateId.trim() : "";
  if (!token || !templateId) {
    return NextResponse.json({ error: "Missing token." }, { status: 400 });
  }

  const config = await getBySendToken(token);
  if (!config) return NextResponse.json({ error: "Link not found." }, { status: 404 });

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
