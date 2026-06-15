import type { ReactNode } from "react";

/**
 * Floating glass navbar used across the app: brand on the left, contextual
 * actions on the right.
 */
export default function Navbar({ right }: { right?: ReactNode }) {
  return (
    <header className="nav-wrap">
      <nav className="navbar">
        <a href="/" className="nav-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-logo" src="/logo.png" alt="LatePass" />
          <span>LatePass</span>
        </a>
        {right ? <div className="nav-actions">{right}</div> : null}
      </nav>
    </header>
  );
}
