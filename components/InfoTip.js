'use client';

import { useEffect, useRef, useState } from 'react';

// Small circular "?" icon that reveals a short helper bubble — meant for a
// one-line hint next to a field label that doesn't need a full persistent
// .hint line under the input.
//
// Two ways to trigger it, for two kinds of pointer:
// - Mouse (laptop/PC): hover or keyboard-focus the icon and the bubble
//   shows, purely via CSS (`.info-tip:hover`/`:focus-within` in
//   globals.css) — no click needed, no state involved.
// - Touch (phone/tablet, no real hover): tapping toggles `open`, which adds
//   the `.open` class the same CSS rule also matches. Tapping outside, or
//   Escape, closes it again.
//
// Safe to nest inside a <label> (see refund/page.js): the click handler
// calls preventDefault(), which stops the label's own "forward the click to
// my associated input" behavior from also firing.
export default function InfoTip({ children }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span className="info-tip" ref={wrapRef}>
      <button
        type="button"
        className="info-tip-trigger"
        aria-label="More information"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
      >
        ?
      </button>
      <span className={`info-tip-bubble${open ? ' open' : ''}`}>{children}</span>
    </span>
  );
}
