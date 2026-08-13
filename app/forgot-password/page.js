'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { alertError, alertSuccess, toastSuccess } from '@/lib/alerts';

// Three-step reset flow against the existing backend contract:
//   1. POST /auth/forgot-password { email }        -> always generic success (anti-enumeration)
//   2. POST /auth/verify-otp      { email, otp }    -> { resetToken, expiresIn } on success
//   3. POST /auth/reset-password  { resetToken, newPassword }
// resetToken is only valid for 10 minutes (RESET_TOKEN_TTL_MINUTES in
// auth.service.js) — if step 3 fails because it expired, the user is sent
// back to step 1 rather than shown a dead-end error.
const STEP = { EMAIL: 'email', OTP: 'otp', RESET: 'reset', DONE: 'done' };

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState(STEP.EMAIL);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      toastSuccess(data.message || 'Code sent');
      setStep(STEP.OTP);
    } catch (err) {
      alertError('Something went wrong', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      const data = await apiFetch('/auth/forgot-password', { method: 'POST', body: { email } });
      toastSuccess(data.message || 'Code sent');
    } catch (err) {
      alertError('Could not resend code', err.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = await apiFetch('/auth/verify-otp', { method: 'POST', body: { email, otp } });
      setResetToken(data.resetToken);
      toastSuccess('Code verified');
      setStep(STEP.RESET);
    } catch (err) {
      alertError('Verification failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alertError('Passwords do not match', 'Please re-enter your new password.');
      return;
    }
    if (newPassword.length < 8) {
      alertError('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const data = await apiFetch('/auth/reset-password', { method: 'POST', body: { resetToken, newPassword } });
      setStep(STEP.DONE);
      await alertSuccess('Password reset', data.message || 'Please log in with your new password.');
      router.replace('/login');
    } catch (err) {
      // A 10-minute-old resetToken (or one already used) will fail here —
      // send them back to the start rather than stall on a dead form.
      alertError('Could not reset password', err.message);
      setStep(STEP.EMAIL);
      setOtp('');
      setResetToken('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <div className="auth-card-wrap">
        <div className="auth-logo">
          <Image src="/logo.png" alt="IMD HUB" width={88} height={88} priority />
        </div>

        <div className="auth-card">
          <div className="auth-brand">
            <div className="subtitle">Internal Staff Management</div>
          </div>

          {step === STEP.EMAIL && (
            <>
              <h1>Reset your password</h1>
              <p className="auth-hint">Enter your account email and we&apos;ll send you a 6-digit verification code.</p>
              <form onSubmit={handleRequestCode}>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send verification code'}
                </button>
              </form>
            </>
          )}

          {step === STEP.OTP && (
            <>
              <h1>Enter verification code</h1>
              <p className="auth-hint">
                If an account exists for <strong>{email}</strong>, a 6-digit code was sent to it. The code expires
                shortly, so enter it soon after it arrives.
              </p>
              <form onSubmit={handleVerifyOtp}>
                <div className="field">
                  <label htmlFor="otp">Verification code</label>
                  <input
                    id="otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>
                <button type="submit" disabled={submitting || otp.length !== 6}>
                  {submitting ? 'Verifying...' : 'Verify code'}
                </button>
              </form>
              <div className="auth-footer">
                <p>
                  Didn&apos;t get a code?{' '}
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleResend();
                    }}
                  >
                    Resend it
                  </a>
                </p>
                <p>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      setStep(STEP.EMAIL);
                      setOtp('');
                    }}
                  >
                    Use a different email
                  </a>
                </p>
              </div>
            </>
          )}

          {step === STEP.RESET && (
            <>
              <h1>Set a new password</h1>
              <p className="auth-hint">Choose a new password. You&apos;ll need to log in again everywhere after this.</p>
              <form onSubmit={handleResetPassword}>
                <div className="field">
                  <label htmlFor="newPassword">New password</label>
                  <input
                    id="newPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirmPassword">Confirm new password</label>
                  <input
                    id="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </>
          )}

          <div className="auth-footer">
            <p>
              Remembered your password? <a href="/login">Back to log in</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
