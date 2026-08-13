'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { apiFetch, setAccessToken, refreshAccessToken } from './apiClient';

const AuthContext = createContext(null);

// How often we quietly re-check "what am I actually allowed to do" while
// someone just sits on one page (no navigation, no tab switch). Balances
// staying reasonably current against not hammering the server.
const PERMISSION_REFRESH_INTERVAL_MS = 30000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [teams, setTeams] = useState([]);
  // null = can manage every team (a global team.manage/team.create grant);
  // an array = only these team IDs — see user.service.js getMe() for how
  // this is resolved from the user's (possibly team-scoped) role assignments.
  const [manageableTeamIds, setManageableTeamIds] = useState(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  // Four different things call loadMe() (mount, pathname change, tab focus,
  // a 30s timer), and in dev React 18 StrictMode double-invokes the mount
  // effect on top of that — without this guard, a single page load can fire
  // several genuinely concurrent /users/me requests at once. If a load is
  // already in flight, piggyback on its result instead of starting a
  // redundant one.
  const inFlightRef = useRef(null);

  const loadMe = useCallback(() => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      try {
        const me = await apiFetch('/users/me');
        setUser(me.user);
        setRoles(me.roles);
        setPermissions(me.permissions);
        setTeams(me.teams);
        setManageableTeamIds(me.manageableTeamIds ?? null);
        return me;
      } finally {
        inFlightRef.current = null;
      }
    })();

    inFlightRef.current = promise;
    return promise;
  }, []);

  // On first mount, try to silently resume a session using the httpOnly
  // refresh cookie — this is what keeps someone logged in across a page
  // reload without ever storing the access token anywhere persistent.
  useEffect(() => {
    (async () => {
      try {
        await refreshAccessToken();
        await loadMe();
      } catch (err) {
        setAccessToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadMe]);

  // Roles/permissions live entirely server-side (a role's permissions, or a
  // user's role assignment, can be edited by an admin at any time — see the
  // Roles & Permissions page) and hasPermission() below just reads whatever
  // was fetched at the last loadMe() call. Without re-fetching periodically,
  // someone whose access was just revoked in another session would keep
  // seeing — and could keep clicking — nav buttons and page actions for
  // things the backend will now correctly reject, until they happened to
  // hard-reload. These three effects keep that window small: re-sync on
  // every client-side navigation, whenever the tab regains focus, and on a
  // 30s timer for anyone parked on a single page. All are silent no-ops
  // when nothing's actually changed, and every real permission check still
  // happens server-side regardless of what this cache says — this is only
  // about the UI catching up promptly, not the actual authorization.
  const isLoggedInRef = useRef(false);
  isLoggedInRef.current = Boolean(user);

  useEffect(() => {
    if (!isLoggedInRef.current) return;
    loadMe().catch(() => {});
    // Deliberately excludes loadMe from deps beyond identity — it's a
    // stable useCallback, and we want this to run on pathname changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isLoggedInRef.current) {
        loadMe().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadMe]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isLoggedInRef.current) loadMe().catch(() => {});
    }, PERMISSION_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMe]);

  const login = async (email, password) => {
    const data = await apiFetch('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(data.accessToken);
    await loadMe();
    return data;
  };

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setTeams([]);
    setManageableTeamIds(null);
  };

  const hasPermission = (key) => permissions.includes(key);

  // null (manage-all) or an array containing this teamId both mean "yes".
  const canManageTeam = (teamId) => manageableTeamIds === null || manageableTeamIds.includes(teamId);

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        permissions,
        teams,
        manageableTeamIds,
        canManageTeam,
        loading,
        login,
        logout,
        hasPermission,
        refresh: loadMe,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
