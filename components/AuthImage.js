'use client';

import { useEffect, useState } from 'react';
import { fetchFileBlob } from '@/lib/apiClient';

// <img> for a User's profilePhotoUrl, which can be in one of two formats:
//   - "data:image/...;base64,..." — set via the self-service avatar upload
//     (see lib/imageUtils.js) — usable directly, no fetch needed.
//   - "/api/files/:id" — set at registration approval, behind our
//     authenticated download endpoint. A plain <img src="/api/files/xyz">
//     can't send the Authorization header, so this fetches the bytes with
//     our normal auth'd fetch and hands the browser a blob: URL instead.
export default function AuthImage({ src, alt = '', className, style, fallback = null }) {
  const isDataUri = typeof src === 'string' && src.startsWith('data:');
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!src || isDataUri) {
      setObjectUrl(null);
      return;
    }
    let cancelled = false;
    let currentUrl = null;

    fetchFileBlob(src)
      .then((url) => {
        if (cancelled) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        currentUrl = url;
        setObjectUrl(url);
      })
      .catch(() => setObjectUrl(null));

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [src, isDataUri]);

  if (isDataUri) return <img src={src} alt={alt} className={className} style={style} />;
  if (!objectUrl) return fallback;
  return <img src={objectUrl} alt={alt} className={className} style={style} />;
}
