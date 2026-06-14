"use client";

import { useState } from "react";
import type { TemplateDraft } from "@/lib/templateDraft";
import { CC_OPTIONS, RECIPIENT_OPTIONS } from "@/lib/contacts";

const PLACEHOLDERS = [
  "{name}",
  "{room}",
  "{roll}",
  "{arrivalTime}",
  "{reason}",
  "{date}",
];

/** Reusable editable fields for one template (used on manage + send pages). */
export default function TemplateFields({
  value,
  onChange,
  showLabel = true,
}: {
  value: TemplateDraft;
  onChange: (patch: Partial<TemplateDraft>) => void;
  showLabel?: boolean;
}) {
  return (
    <>
      {showLabel ? (
        <div className="field">
          <label>Template name</label>
          <input
            value={value.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Late arrival"
          />
        </div>
      ) : null}

      <div className="field">
        <label>Warden / recipient email</label>
        <input
          type="email"
          list="recipient-options"
          value={value.recipient}
          onChange={(e) => onChange({ recipient: e.target.value })}
          placeholder="warden@hostel.edu"
        />
        <datalist id="recipient-options">
          {RECIPIENT_OPTIONS.map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
        {RECIPIENT_OPTIONS.length > 0 ? (
          <div className="suggest">
            {RECIPIENT_OPTIONS.map((o) => (
              <button
                type="button"
                key={o}
                className="chip-btn"
                onClick={() => onChange({ recipient: o })}
              >
                {o}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="field">
        <label>CC (optional)</label>
        <CcInput value={value.cc} onChange={(cc) => onChange({ cc })} />
      </div>

      <div className="field">
        <label>Subject</label>
        <input
          value={value.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </div>

      <div className="field">
        <label>Message</label>
        <textarea
          value={value.body}
          onChange={(e) => onChange({ body: e.target.value })}
        />
        <div className="chips">
          {PLACEHOLDERS.map((p) => (
            <span className="chip" key={p}>
              {p}
            </span>
          ))}
        </div>
        <p className="hint">
          {"{date}"} fills in automatically with the day you send.
        </p>
      </div>

      <div className="grid-2">
        <div className="field">
          <label>Name {"{name}"}</label>
          <input
            value={value.field_name}
            onChange={(e) => onChange({ field_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Roll no. {"{roll}"}</label>
          <input
            value={value.field_roll}
            onChange={(e) => onChange({ field_roll: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Room {"{room}"}</label>
          <input
            value={value.field_room}
            onChange={(e) => onChange({ field_room: e.target.value })}
          />
        </div>
        <div className="field">
          <label>Arrival time {"{arrivalTime}"}</label>
          <input
            value={value.field_arrival_time}
            onChange={(e) => onChange({ field_arrival_time: e.target.value })}
            placeholder="around 11:30 PM"
          />
        </div>
      </div>

      <div className="field">
        <label>Reason {"{reason}"}</label>
        <input
          value={value.field_reason}
          onChange={(e) => onChange({ field_reason: e.target.value })}
          placeholder="returning from home / event ran late"
        />
      </div>
    </>
  );
}

function splitEmails(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Multi-email input: chips you can add (typed or from suggestions) + remove. */
function CcInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const emails = splitEmails(value);

  function commit(list: string[]) {
    onChange(list.join(", "));
  }

  function add(email: string) {
    const e = email.trim().replace(/,$/, "");
    if (!e || emails.includes(e)) {
      setDraft("");
      return;
    }
    commit([...emails, e]);
    setDraft("");
  }

  function remove(email: string) {
    commit(emails.filter((x) => x !== email));
  }

  const suggestions = CC_OPTIONS.filter((o) => !emails.includes(o));

  return (
    <>
      {emails.length > 0 ? (
        <div className="emails">
          {emails.map((e) => (
            <span className="email-chip" key={e}>
              {e}
              <button type="button" onClick={() => remove(e)} aria-label={`Remove ${e}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}

      <input
        type="email"
        value={draft}
        list="cc-options"
        placeholder="Add an email, press Enter"
        onChange={(e) => {
          const v = e.target.value;
          // Selecting a datalist option or typing a comma commits it.
          if (v.endsWith(",") || CC_OPTIONS.includes(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add(draft);
          }
        }}
        onBlur={() => add(draft)}
      />
      <datalist id="cc-options">
        {suggestions.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      {suggestions.length > 0 ? (
        <div className="suggest">
          {suggestions.map((o) => (
            <button
              type="button"
              key={o}
              className="chip-btn"
              onClick={() => add(o)}
            >
              + {o}
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
