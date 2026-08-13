'use client';

import AppShell from '@/components/AppShell';
import { useSystemUpdateStatus } from '@/lib/useSystemUpdate';

const CheckIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <path d="M5 12.5l4.5 4.5L19 7" />
  </svg>
);

// Read-only — nobody publishes updates through the app. The content here
// comes straight from SYSTEM_UPDATE_CONFIG (lib/systemUpdate.config.js),
// which only the developer edits directly in code. If the user landed here
// with the latest version still unacknowledged, the "Agree" button doubles
// as a manual way to clear it (SystemUpdateGate already forces this on
// every page, so this is just a fallback, not the primary path).
export default function SystemUpdatesPage() {
  const { pending, config, agree } = useSystemUpdateStatus();

  return (
    <AppShell title="System Updates">
      <div className="page-header">
        <div>
          <h1>System Updates</h1>
          <p>What&apos;s changed in the current version of IMD HUB</p>
        </div>
      </div>

      <div className="update-hero">
        <div className="update-hero-text">
          <div className="system-update-gate-badge">Version {config.version}</div>
          <h2>{config.title}</h2>
          {config.description && <p>{config.description}</p>}
          {pending && (
            <button type="button" className="btn" onClick={agree} style={{ marginTop: 'var(--space-4)' }}>
              I&apos;ve read this — Agree
            </button>
          )}
        </div>
        <div className="update-hero-badge-icon">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M10.5 3.5L4 7v6c0 4.2 2.8 7 8 9.5 5.2-2.5 8-5.3 8-9.5V7l-6.5-3.5z" />
            <path d="M9 12.2l2 2 4.2-4.4" />
          </svg>
        </div>
      </div>

      {config.notes?.length > 0 && (
        <div className="update-notes-grid">
          {config.notes.map((note, i) => (
            <div className="update-note-card" key={i}>
              <div className="update-note-icon"><CheckIcon /></div>
              <p>{note}</p>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
