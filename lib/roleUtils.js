// Mirrors the priority order used server-side (see enrichStaffList in
// be/src/services/user.service.js) — when a user holds more than one active
// role assignment (e.g. a global grant plus a team-scoped one), the
// highest-ranking one is what should drive any "what is this person" UI
// decision (badge wording, which profile layout to show, ...).
const ROLE_PRIORITY = ['Department Manager', 'Department Admin', 'Team Admin'];

// `roles` is AuthContext's roles array: [{ roleId, roleName, scopeType, scopeId, validUntil }, ...]
export const primaryRoleName = (roles) => {
  if (!roles || roles.length === 0) return 'Staff';
  for (const name of ROLE_PRIORITY) {
    if (roles.some((r) => r.roleName === name)) return name;
  }
  return roles[0].roleName || 'Staff';
};

export const isManagerRole = (roleName) => roleName === 'Department Manager';

// The account-status badge always reads "Active"/"Inactive"/etc regardless
// of role. This is about the *second* badge — staffStatus — whose label
// depends on whether the person holds an administrative role ("Role: ...")
// or is plain Staff ("Staff: ..."). Returns null for the Manager, who
// doesn't get a second badge at all (see ProfilePage/UsersPage).
export const staffStatusBadgeLabel = (roleName) => {
  if (isManagerRole(roleName)) return null;
  return roleName && roleName !== 'Staff' ? 'Role' : 'Staff';
};
