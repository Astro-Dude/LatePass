"use client";

import { useState } from "react";
import TemplateFields from "@/components/TemplateFields";
import type { TemplateDraft } from "@/lib/templateDraft";

type Phase = "idle" | "confirm" | "sending" | "sent";

export default function SendApp({
  token,
  fromEmail,
  today,
  initialTemplates,
}: {
  token: string;
  fromEmail: string;
  today: string;
  initialTemplates: TemplateDraft[];
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedId, setSelectedId] = useState(initialTemplates[0]?.id ?? "");
  const [phase, setPhase] = useState<Phase>("idle");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedNote, setSavedNote] = useState("");
  const [savedSnap, setSavedSnap] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialTemplates.map((t) => [t.id, JSON.stringify(t)])),
  );

  const selected =
    templates.find((t) => t.id === selectedId) ?? templates[0];
  const dirty = selected
    ? savedSnap[selected.id] !== JSON.stringify(selected)
    : false;

  if (!selected) {
    return (
      <p>
        This link isn&apos;t set up yet. Open your manage link to add a template.
      </p>
    );
  }

  function patchSelected(patch: Partial<TemplateDraft>) {
    setTemplates((ts) =>
      ts.map((t) => (t.id === selected.id ? { ...t, ...patch } : t)),
    );
    setSavedNote("");
  }

  async function saveEdits() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/send/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, templateId: selected.id, ...selected }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setSavedSnap((s) => ({ ...s, [selected.id]: JSON.stringify(selected) }));
      setSavedNote("Saved ✓");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    setPhase("sending");
    setError("");
    try {
      const res = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, templateId: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't send.");
      setPhase("sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send.");
      setPhase("idle");
    }
  }

  if (phase === "sent") {
    return (
      <div className="success">
        <div className="check">
          <svg viewBox="0 0 52 52" aria-hidden="true">
            <path d="M14 27 l8 8 l16 -18" />
          </svg>
        </div>
        <h2 style={{ margin: 0 }}>Sent ✓</h2>
        <p className="muted" style={{ margin: 0 }}>
          Your note is on its way. You can close this.
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 24 }}>Send late-arrival note</h1>
      <p className="muted">From {fromEmail}</p>

      {templates.length > 1 ? (
        <div className="tabs" style={{ justifyContent: "center", marginTop: 14 }}>
          {templates.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`tab ${t.id === selected.id ? "active" : ""}`}
              onClick={() => {
                setSelectedId(t.id);
                setEditing(false);
              }}
            >
              {t.label || "Untitled"}
            </button>
          ))}
        </div>
      ) : null}

      {error ? (
        <div className="banner error" style={{ marginTop: 16 }}>
          {error}
        </div>
      ) : null}

      <div className="send-preview">
        <div className="row">
          <span className="k">To</span>
          <span className="v">{selected.recipient}</span>
        </div>
        {selected.cc ? (
          <div className="row">
            <span className="k">Cc</span>
            <span className="v">{selected.cc}</span>
          </div>
        ) : null}
        <div className="row">
          <span className="k">Subject</span>
          <span className="v">{selected.subject}</span>
        </div>
        <div className="row">
          <span className="k">Date</span>
          <span className="v">{today}</span>
        </div>
      </div>

      {phase === "confirm" ? (
        <div className="btn-row">
          <button className="btn secondary" onClick={() => setPhase("idle")}>
            Cancel
          </button>
          <button className="btn" onClick={send}>
            Yes, send
          </button>
        </div>
      ) : (
        <button
          className="btn"
          onClick={() => setPhase("confirm")}
          disabled={phase === "sending"}
        >
          {phase === "sending" ? (
            <>
              <span className="spinner" />
              Sending…
            </>
          ) : (
            "Send now"
          )}
        </button>
      )}

      <button
        className="btn ghost"
        style={{ marginTop: 10 }}
        onClick={() => {
          setEditing((v) => !v);
          setSavedNote("");
        }}
      >
        {editing ? "Hide customise" : "Customise this message"}
      </button>

      {editing ? (
        <div style={{ textAlign: "left", marginTop: 16 }}>
          <hr className="divider" />
          <TemplateFields
            value={selected}
            onChange={patchSelected}
            showLabel={false}
          />
          <div className="row-between" style={{ marginTop: 8 }}>
            <span className="muted">{savedNote}</span>
            <button
              className="btn secondary"
              style={{ width: "auto" }}
              onClick={saveEdits}
              disabled={saving || !dirty}
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
