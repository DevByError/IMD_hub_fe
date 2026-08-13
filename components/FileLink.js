'use client';

import { useState } from 'react';
import { fetchFileBlob } from '@/lib/apiClient';
import { toastError } from '@/lib/alerts';

// Link-styled button for opening a protected file (CV, MC document) in a new
// tab. Can't be a plain <a href> for the same reason AuthImage can't be a
// plain <img> — the download needs an Authorization header.
export default function FileLink({ src, children }) {
  const [loading, setLoading] = useState(false);

  if (!src) return <span className="detail-item value muted">Not provided</span>;

  const open = async () => {
    setLoading(true);
    try {
      const url = await fetchFileBlob(src);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      toastError('Could not open file.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="link-btn" onClick={open} disabled={loading}>
      {loading ? 'Opening...' : children || 'View'}
    </button>
  );
}
