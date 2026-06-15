"use client";

import { useState } from "react";

export interface MenuItem {
  label: string;
  icon?: string;
  href?: string;
  onClick?: () => void;
  danger?: boolean;
  active?: boolean;
  /** Render a divider above this item. */
  sep?: boolean;
}

function deriveName(email: string): string {
  const local = email.split("@")[0] || "";
  const first = local.split(/[._-]/)[0] || local;
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : "Account";
}

/** Avatar button that opens a glass dropdown (name/email, items, logout). */
export default function ProfileMenu({
  email,
  name,
  avatarUrl,
  items,
}: {
  email: string;
  name?: string | null;
  avatarUrl?: string | null;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const initial = (email || "?").trim().charAt(0).toUpperCase();
  const displayName = name || deriveName(email);
  const showImg = Boolean(avatarUrl) && imgOk;

  return (
    <div className="pm">
      <button
        type="button"
        className="pm-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
      >
        {showImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="pm-avatar-img"
            src={avatarUrl as string}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgOk(false)}
          />
        ) : (
          initial
        )}
      </button>

      {open ? (
        <>
          <div className="pm-overlay" onClick={() => setOpen(false)} />
          <div className="pm-menu" role="menu">
            <div className="pm-head">
              <div className="pm-name">{displayName}</div>
              <div className="pm-email">{email}</div>
            </div>
            <div className="pm-sep" />
            {items.map((it) => (
              <div key={it.label}>
                {it.sep ? <div className="pm-sep" /> : null}
                {it.href ? (
                  <a
                    href={it.href}
                    className={`pm-item ${it.danger ? "danger" : ""} ${it.active ? "active" : ""}`}
                    role="menuitem"
                  >
                    {it.icon ? <span className="pm-ico">{it.icon}</span> : null}
                    {it.label}
                  </a>
                ) : (
                  <button
                    type="button"
                    className={`pm-item ${it.danger ? "danger" : ""} ${it.active ? "active" : ""}`}
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      it.onClick?.();
                    }}
                  >
                    {it.icon ? <span className="pm-ico">{it.icon}</span> : null}
                    {it.label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
