'use client';

import { useEffect } from 'react';

// Generic dialog overlay used everywhere we need a form/detail popup
// (create team, assign role, approve registration, apply for leave, ...).
// Closes on Escape or backdrop click; `footer` is optional (some modals are
// read-only detail views with nothing to submit).
export default function Modal({ title, onClose, children, footer, wide = false }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal-box${wide ? ' wide' : ''}`}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
