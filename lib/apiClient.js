const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Access token lives in memory only (module-level variable), never
// localStorage/sessionStorage — it resets on a full page reload, which is
// fine because AuthContext re-establishes it via a silent /auth/refresh
// call (using the httpOnly cookie) as soon as the app mounts.
let accessToken = null;
export const setAccessToken = (token) => {
  accessToken = token;
};
export const getAccessToken = () => accessToken;

let refreshInFlight = null;
const refreshAccessToken = async () => {
  if (!refreshInFlight) {
    // The endpoint always responds 200 (see auth.controller.js) — a missing
    // or expired session is reported via `authenticated: false` in the body,
    // not an HTTP error status, so a logged-out visitor never produces a
    // failed-request line in the browser console. We still throw here on
    // that case so existing callers (the 401-retry logic below, and
    // AuthContext's mount check) keep working exactly as before.
    refreshInFlight = fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Session refresh failed');
        const data = await res.json();
        if (!data.authenticated) {
          accessToken = null;
          throw new Error('No active session');
        }
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

const buildError = async (res) => {
  const data = await res.json().catch(() => null);
  const error = new Error(data?.message || 'Request failed');
  error.status = res.status;
  error.details = data?.details;
  return error;
};

// JSON requests. On a 401 (expired access token), transparently refreshes
// once via the httpOnly cookie and retries — callers don't need to think
// about token expiry.
export async function apiFetch(path, { method = 'GET', body, retry = true, ...rest } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    ...rest,
  });

  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    try {
      await refreshAccessToken();
      return apiFetch(path, { method, body, retry: false, ...rest });
    } catch (err) {
      // fall through — surfaces as a normal 401 below
    }
  }

  if (!res.ok) throw await buildError(res);
  return res.json().catch(() => null);
}

// multipart/form-data requests (file uploads, the registration form). Pass a
// FormData instance directly — no Content-Type header here on purpose, the
// browser sets the multipart boundary itself.
export async function apiFetchForm(path, formData, { method = 'POST', retry = true } = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: formData,
  });

  if (res.status === 401 && retry) {
    try {
      await refreshAccessToken();
      return apiFetchForm(path, formData, { method, retry: false });
    } catch (err) {
      // fall through
    }
  }

  if (!res.ok) throw await buildError(res);
  return res.json().catch(() => null);
}

// Uploaded files (CV, profile photo, MC documents) are served from an
// authenticated endpoint (GET /api/files/:id — see upload.controller.js),
// never a static/public URL, so a plain <img src="..."> or <a href="...">
// can't load one (no way to attach the Authorization header). The stored
// *Url fields already look like "/api/files/<id>" — resolve that against
// the API's origin (not the frontend's) here.
const API_ORIGIN = API_URL.replace(/\/api\/?$/, '');
export const resolveFileUrl = (path) => (path ? `${API_ORIGIN}${path.startsWith('/api') ? path : `/api${path}`}` : null);

// Fetches a protected file as a blob and hands back an object URL the
// caller can drop into <img src> / window.open() / a download link. Caller
// is responsible for URL.revokeObjectURL() once it's no longer needed.
export async function fetchFileBlob(path) {
  const url = resolveFileUrl(path);
  if (!url) return null;

  const doFetch = () =>
    fetch(url, {
      credentials: 'include',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

  let res = await doFetch();
  if (res.status === 401) {
    try {
      await refreshAccessToken();
      res = await doFetch();
    } catch (err) {
      // fall through — surfaces as a normal failure below
    }
  }

  if (!res.ok) throw new Error('Unable to load file.');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export { refreshAccessToken };
