// Developer-only file. Nobody manages System Updates through the app — no
// role, no permission, no admin form. To publish a new update: edit this
// file (bump `version`, update `title`/`description`/`notes`), commit, and
// deploy. The moment `version` changes, every user who hasn't already
// accepted the new version gets blocked by SystemUpdateGate on their next
// page load until they click Agree — see lib/useSystemUpdate.js for how
// that comparison happens.
export const SYSTEM_UPDATE_CONFIG = {
  version: '1.0.0.9',
  title: 'System Update',
  description: 'A round of improvements across roles, leave, and teams.',
  notes: [
    'Role Assignments now only shows each user\'s current role; a new Role Assignment History table tracks every past grant and revoke.',
    'Medical Leave is now applied for with just a start date — an admin records the return date once the staff member is back, and the system automatically works out unpaid days beyond the entitlement.',
    'A Team Admin can now only manage their own team, not every team, unless the Manager grants broader access.',
    'Added a Public Holidays tab — every date added there is automatically excluded from all leave day calculations.',
    'Added this System Update notice, so everyone is kept in the loop when something changes.',
  ],
};

// Suffixed per-user (see useSystemUpdate.js) so acknowledgment tracks the
// logged-in account, not just the browser — two different staff sharing one
// computer still each get their own prompt.
export const SYSTEM_UPDATE_STORAGE_KEY = 'imd-hub-system-update-accepted-version';
