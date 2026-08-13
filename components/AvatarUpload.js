'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/apiClient';
import { resizeImageToBase64 } from '@/lib/imageUtils';
import { alertError, toastSuccess } from '@/lib/alerts';
import AuthImage from './AuthImage';

const CameraIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

// Click-the-circle avatar upload — resizes/compresses the picked image
// client-side (see lib/imageUtils.js), then POSTs the resulting base64
// data URI to POST /users/:id/photo. Self-service only: `userId` should
// always be the logged-in user's own id (the endpoint rejects anything else).
export default function AvatarUpload({ userId, src, alt, fallback, size = 72, onUploaded }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const openPicker = () => inputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizeImageToBase64(file);
      const result = await apiFetch(`/users/${userId}/photo`, { method: 'POST', body: { imageBase64: dataUrl } });
      toastSuccess('Profile photo updated');
      onUploaded?.(result.user);
    } catch (err) {
      alertError('Could not update photo.', err.message);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div
      className="avatar-upload"
      style={{ width: size, height: size }}
      role="button"
      tabIndex={0}
      title="Change profile photo"
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
    >
      <AuthImage src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover' }} fallback={fallback} />
      <div className="avatar-upload-overlay">{uploading ? '...' : <CameraIcon />}</div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
