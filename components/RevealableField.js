'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { toastError } from '@/lib/alerts';

// Shows a masked value (e.g. "••••4821") with a "Show" toggle that fetches
// the real value on demand from an authenticated, audited endpoint. Used for
// the ID document number, which the backend never includes in full in the
// ordinary profile/list responses (see user.service.js / registration.service.js
// revealIdDocumentNumber) — every reveal is server-side permission-checked
// and written to the audit log, so this button is a real action, not
// decoration. Fetches once per mount; toggling back to "Hide" doesn't re-fetch.
export default function RevealableField({ maskedValue, fetchUrl }) {
  const [revealed, setRevealed] = useState(null); // null = not fetched yet
  const [showing, setShowing] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!maskedValue) return <>—</>;

  const toggle = async () => {
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
      setRevealed(data.idDocumentNumber || '');
      setShowing(true);
    } catch (err) {
      toastError('Could not reveal this value.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {showing && revealed !== null ? revealed : maskedValue}
      <button type="button" className="link-btn" onClick={toggle} disabled={loading}>
        {loading ? '...' : showing ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}
