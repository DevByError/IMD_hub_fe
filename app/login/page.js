'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { alertError, toastSuccess } from '@/lib/alerts';

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Already logged in (e.g. session resumed via the refresh cookie) —
  // skip straight past the login form.
  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [loading, user, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email, password);
      toastSuccess('Logged in');
      router.replace('/');
    } catch (err) {
      // System notifications go through SweetAlert2 (see lib/alerts.js) —
      // never window.alert()/confirm() or the browser Notification API.
      alertError('Login failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || user) return null;

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

          <h1>Log in</h1>

          <form onSubmit={handleSubmit}>
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
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Logging in...' : 'Log in'}
            </button>
          </form>

          <div className="auth-footer">
            <p>
              Forgot your password? <a href="/forgot-password">Reset it</a>
            </p>
            <p>
              New here? <a href="/register">Apply for an account</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
