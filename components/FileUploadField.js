'use client';

import { useRef, useState } from 'react';

const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 16V4M12 4l-4 4M12 4l4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
);

// Click-or-drag file picker with the native <input type="file"> visually
// hidden — its default "Choose File" button can't be restyled consistently
// across browsers, so we trigger it programmatically from a fully custom,
// themed drop zone instead.
export default function FileUploadField({ id, accept, file, onChange }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = (fileList) => {
    onChange(fileList?.[0] || null);
  };

  const openPicker = () => inputRef.current?.click();

  return (
    <div
      className={`file-drop${dragOver ? ' drag-over' : ''}${file ? ' has-file' : ''}`}
      role="button"
      tabIndex={0}
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
        style={{ display: 'none' }}
      />
      <div className="file-drop-icon">
        <UploadIcon />
      </div>
      {file ? (
        <div className="file-drop-name">{file.name}</div>
      ) : (
        <div className="file-drop-text">
          <strong>Click to upload</strong> or drag and drop
        </div>
      )}
      {file && (
        <button
          type="button"
          className="file-drop-remove"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
        >
          Remove
        </button>
      )}
    </div>
  );
}
