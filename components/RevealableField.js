'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { toastError } from '@/lib/alerts';

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l18 18" />
    <path d="M10.6 5.1A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7a13.2 13.2 0 0 1-3.1 4M6.6 6.6C3.4 8.5 1.5 12 1.5 12s3.5 7 10.5 7c1.4 0 2.6-.3 3.7-.7" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
);

// Shows a masked value (e.g. "••••4821") with an eye icon that fetches the
// real value on demand from an authenticated, audited endpoint. Used for the
// ID document number, which the backend never includes in full in the
// ordinary profile/list responses (see user.service.js / registration.service.js
// revealIdDocumentNumber) — every reveal is server-side permission-checked
// and written to the audit log, so this button is a real action, not
// decoration. Fetches once per mount; toggling back to hidden doesn't re-fetch.
//
// Deliberately its own small icon button rather than reusing .link-btn — the
// global `button { width: 100% }` rule (see globals.css) made a text button
// here awkward to keep correctly sized inline next to the masked value; a
// fixed-size icon button sidesteps that entirely instead of fighting it.
export default function RevealableField({ maskedValue, fetchUrl }) {
  const [revealed, setRevealed] = useState(null); // null = not fetched yet
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!maskedValue) return <>—</>;

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (showing) {
      setShowing(false);
      return;
    }
    if (revealed !== null) {
      setShowing(true);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch(fetchUrl);
      setRevealed(data?.idDocumentNumber || '');
      setShowing(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('RevealableField: failed to fetch', fetchUrl, err);
      toastError(err?.message || 'Could not reveal this value.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span>{showing && revealed !== null ? revealed : maskedValue}</span>
      <button
        type="button"
        className="reveal-toggle"
        onClick={toggle}
        disabled={loading}
        aria-label={showing ? 'Hide value' : 'Show value'}
        title={showing ? 'Hide' : 'Show'}
      >
        {loading ? (
          <span className="reveal-toggle-spinner" />
        ) : showing ? (
          <EyeOffIcon />
        ) : (
          <EyeIcon />
        )}
      </button>
    </span>
  );
}
