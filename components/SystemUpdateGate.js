'use client';

import { useSystemUpdateStatus } from '@/lib/useSystemUpdate';

// Full-screen, non-dismissible overlay — deliberately NOT built on the
// shared <Modal> (which closes on Escape/backdrop click). Rendered once
// inside AppShell, so it sits on top of every authenticated page and blocks
// all interaction until the user clicks "Agree" — there is no close button,
// no backdrop-click handler, and no Escape handler. Driven entirely by
// SYSTEM_UPDATE_CONFIG (see lib/systemUpdate.config.js) — the developer
// edits that file directly; nothing here talks to the backend.
export default function SystemUpdateGate() {
  const { pending, config, agree } = useSystemUpdateStatus();

  if (!pending) return null;

  return (
    <div className="system-update-gate" role="alertdialog" aria-modal="true">
      <div className="system-update-gate-box">
        <div className="system-update-gate-badge">System Update</div>
        <h2>{config.title}</h2>
        <div className="system-update-gate-version">Version {config.version}</div>
        {config.description && <p className="system-update-gate-description">{config.description}</p>}
        {config.notes?.length > 0 && (
          <ul className="system-update-gate-notes">
            {config.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        )}
        <button type="button" className="btn" onClick={agree}>
          I&apos;ve read this — Agree &amp; Continue
        </button>
      </div>
    </div>
  );
}
