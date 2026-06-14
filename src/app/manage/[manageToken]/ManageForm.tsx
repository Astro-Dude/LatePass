"use client";

import { useState } from "react";
import TemplateFields from "@/components/TemplateFields";
import { toDraft, type TemplateDraft } from "@/lib/templateDraft";

const MAX_TEMPLATES = 3;

export default function ManageForm({
  manageToken,
  baseUrl,
  initialSendToken,
  email,
  dailyCap: initialDailyCap,
  initialTemplates,
}: {
  manageToken: string;
  baseUrl: string;
  initialSendToken: string;
  email: string;
  dailyCap: number;
  initialTemplates: TemplateDraft[];
}) {
  const [templates, setTemplates] = useState<TemplateDraft[]>(initialTemplates);
  const [selectedId, setSelectedId] = useState(
    initialTemplates[0]?.id ?? "",
  );
  const [sendToken, setSendToken] = useState(initialSendToken);
  const [dailyCap, setDailyCap] = useState(initialDailyCap);
  const [status, setStatus] = useState<
    { kind: "ok" | "error"; msg: string } | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  // Snapshot of each template as last persisted, to detect unsaved changes.
  const [savedSnap, setSavedSnap] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTemplates.map((t) => [t.id, JSON.stringify(t)])),
  );

  const sendUrl = `${baseUrl}/t/${sendToken}`;
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const dirty = selected
    ? savedSnap[selected.id] !== JSON.stringify(selected)
    : false;

  function patchSelected(patch: Partial<TemplateDraft>) {
    setTemplates((ts) =>
      ts.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)),
    );
  }

  function flash(kind: "ok" | "error", msg: string) {
    setStatus({ kind, msg });
  }

  async function saveTemplate() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(
        `/api/config/${manageToken}/templates/${selected.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(selected),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setSavedSnap((s) => ({ ...s, [selected.id]: JSON.stringify(selected) }));
      flash("ok", "Template saved.");
    } catch (err) {
      flash("error", err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function addTemplate() {
    setStatus(null);
    const res = await fetch(`/api/config/${manageToken}/templates`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) return flash("error", data.error || "Could not add.");
    const draft = toDraft(data.template);
    setTemplates((ts) => [...ts, draft]);
    setSavedSnap((s) => ({ ...s, [draft.id]: JSON.stringify(draft) }));
    setSelectedId(draft.id);
  }

  async function removeTemplate() {
    if (templates.length <= 1) return;
    if (!confirm(`Delete "${selected.label}"?`)) return;
    const res = await fetch(
      `/api/config/${manageToken}/templates/${selected.id}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    if (!res.ok) return flash("error", data.error || "Could not delete.");
    const remaining = templates.filter((t) => t.id !== selected.id);
    setTemplates(remaining);
    setSelectedId(remaining[0]?.id ?? "");
  }

  async function saveDailyCap(value: number) {
    setDailyCap(value);
    await fetch(`/api/config/${manageToken}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_cap: value }),
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(sendUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* link is selectable in the box */
    }
  }

  async function regenerate() {
    if (
      !confirm(
        "Generate a new link? Your current home-screen icon will stop working.",
      )
    )
      return;
    const res = await fetch(`/api/config/${manageToken}`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.sendToken) {
      setSendToken(data.sendToken);
      flash("ok", "New link generated. Add it to your home screen again.");
    }
  }

  return (
    <>
      {/* Send link */}
      <div className="card">
        <h2>Your send link</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Open this on your phone and use “Add to Home Screen”. From there you can
          pick a template, tweak it, and send.
        </p>
        <div className="linkbox">
          <code>{sendUrl}</code>
          <button
            type="button"
            className="btn copybtn secondary"
            onClick={copyLink}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="btn-row" style={{ marginTop: 12 }}>
          <a
            className="btn"
            href={sendUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open send page
          </a>
          <button type="button" className="btn ghost" onClick={regenerate}>
            Regenerate
          </button>
        </div>

        <details style={{ marginTop: 16 }}>
          <summary className="muted" style={{ cursor: "pointer" }}>
            How to add it to my home screen
          </summary>
          <div style={{ marginTop: 10 }}>
            <p className="hint" style={{ margin: "0 0 8px" }}>
              <strong>iPhone (Safari):</strong> open the link → Share button →
              “Add to Home Screen”.
            </p>
            <p className="hint" style={{ margin: 0 }}>
              <strong>Android (Chrome):</strong> open the link → ⋮ menu → “Add to
              Home screen”.
            </p>
          </div>
        </details>
      </div>

      {/* Templates */}
      <div className="card">
        <h2>Your templates</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Sends from <strong>{email}</strong>. Up to {MAX_TEMPLATES} templates —
          all editable anytime.
        </p>

        {status ? (
          <div className={`banner ${status.kind}`}>{status.msg}</div>
        ) : null}

        <div className="tabs">
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${t.id === selected?.id ? "active" : ""}`}
              onClick={() => setSelectedId(t.id)}
            >
              {t.label || "Untitled"}
            </button>
          ))}
          {templates.length < MAX_TEMPLATES ? (
            <button type="button" className="tab add" onClick={addTemplate}>
              + Add
            </button>
          ) : null}
        </div>

        {selected ? (
          <>
            <TemplateFields value={selected} onChange={patchSelected} />
            <div className="btn-row" style={{ marginTop: 8 }}>
              <button
                className="btn"
                type="button"
                onClick={saveTemplate}
                disabled={saving || !dirty}
              >
                {saving ? "Saving…" : dirty ? "Save template" : "Saved"}
              </button>
              {templates.length > 1 ? (
                <button
                  className="btn danger"
                  type="button"
                  onClick={removeTemplate}
                >
                  Delete
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>

      {/* Config */}
      <div className="card">
        <h2>Safety</h2>
        <div className="field">
          <label htmlFor="cap">Daily send limit</label>
          <input
            id="cap"
            type="number"
            min={1}
            max={50}
            value={dailyCap}
            onChange={(e) => saveDailyCap(Number(e.target.value))}
          />
          <p className="hint">
            Max sends per day across all templates. Saved automatically.
          </p>
        </div>
      </div>

      <p className="footer-note">
        Keep this manage link private — it can edit everything and regenerate
        your send link.
      </p>
    </>
  );
}
