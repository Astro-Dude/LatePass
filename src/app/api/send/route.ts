import { NextResponse, type NextRequest } from "next/server";
import {
  countSendsToday,
  getBySendToken,
  getTemplateForConfig,
  logSend,
  type Template,
} from "@/lib/config";
import { decrypt } from "@/lib/crypto";
import { getSender } from "@/lib/email";
import { formatDate, renderTemplate } from "@/lib/template";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Send a chosen template from the student's own Gmail.
 *
 * Guardrails: token-only access, per-token daily cap, every attempt logged.
 */
export async function POST(req: NextRequest) {
  let body: { token?: string; templateId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const token = body.token?.trim();
  const templateId = body.templateId?.trim();
  if (!token || !templateId) {
    return NextResponse.json({ error: "Missing details." }, { status: 400 });
  }

  const config = await getBySendToken(token);
  if (!config) {
    return NextResponse.json({ error: "Link not found." }, { status: 404 });
  }

  const template = await getTemplateForConfig(config.id, templateId);
  if (!template) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }
  if (!template.recipient) {
    return NextResponse.json(
      { error: "This template has no recipient yet." },
      { status: 400 },
    );
  }

  // Daily cap (per config, across all templates).
  const sentToday = await countSendsToday(config.id);
  if (sentToday >= config.daily_cap) {
    await logSend(config.id, template.id, "capped", template.recipient);
    return NextResponse.json(
      {
        error: `Daily limit reached (${config.daily_cap}). Try again tomorrow.`,
        capped: true,
      },
      { status: 429 },
    );
  }

  try {
    const { subject, text } = render(template);
    const sender = getSender(config.provider);
    await sender.send(
      {
        fromEmail: config.user_email,
        to: template.recipient,
        cc: template.cc,
        subject,
        text,
      },
      decrypt(config.encrypted_credential),
    );

    await logSend(config.id, template.id, "sent", template.recipient);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to send the email.";
    await logSend(config.id, template.id, "error", template.recipient, message);
    return NextResponse.json(
      { error: "Couldn't send right now. Please try again." },
      { status: 502 },
    );
  }
}

function render(template: Template): { subject: string; text: string } {
  const values = {
    name: template.field_name,
    room: template.field_room,
    roll: template.field_roll,
    arrivalTime: template.field_arrival_time,
    reason: template.field_reason,
    date: formatDate(),
  };
  return {
    subject: renderTemplate(template.subject, values),
    text: renderTemplate(template.body, values),
  };
}
