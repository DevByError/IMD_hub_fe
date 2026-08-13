import Swal from 'sweetalert2';

// Single point of truth for all system notifications in this app. Convention:
// SweetAlert2 only — never window.alert()/confirm() and never the browser
// Notification API. Every component should import from here rather than
// calling Swal directly, so the look/behavior stays consistent app-wide.

const BASE_COLOR = '#1a1a1a';
const DANGER_COLOR = '#c53030';

export const alertSuccess = (title, text) =>
  Swal.fire({ icon: 'success', title, text, confirmButtonColor: BASE_COLOR });

export const alertError = (title, text) =>
  Swal.fire({ icon: 'error', title, text, confirmButtonColor: BASE_COLOR });

export const alertInfo = (title, text) =>
  Swal.fire({ icon: 'info', title, text, confirmButtonColor: BASE_COLOR });

// Replaces window.confirm() for destructive/consequential actions
// (revoke a role, reject a leave request, delete a team, etc).
export const confirmAction = async (title, text, { confirmButtonText = 'Yes', cancelButtonText = 'Cancel', danger = true } = {}) => {
  const result = await Swal.fire({
    icon: 'warning',
    title,
    text,
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: danger ? DANGER_COLOR : BASE_COLOR,
    cancelButtonColor: '#6b7280',
  });
  return result.isConfirmed;
};

// Lightweight, auto-dismissing corner toast — use this for routine
// confirmations ("Saved", "Leave request submitted") instead of a modal or
// a browser notification.
const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

export const toastSuccess = (title) => toast.fire({ icon: 'success', title });
export const toastError = (title) => toast.fire({ icon: 'error', title });
export const toastInfo = (title) => toast.fire({ icon: 'info', title });

// Replaces window.prompt() — used for optional decision comments, rejection
// reasons, etc. Returns the trimmed string, or null if the user cancelled
// (never an empty string for "cancelled", so callers can tell the two apart).
export const promptText = async (title, { text, placeholder = '', required = false, confirmButtonText = 'Submit' } = {}) => {
  const { value, isConfirmed } = await Swal.fire({
    title,
    text,
    input: 'textarea',
    inputPlaceholder: placeholder,
    showCancelButton: true,
    confirmButtonText,
    confirmButtonColor: BASE_COLOR,
    cancelButtonColor: '#6b7280',
    inputValidator: (v) => (required && !v?.trim() ? 'This field is required.' : undefined),
  });
  if (!isConfirmed) return null;
  return (value || '').trim();
};
