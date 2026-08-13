'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { apiFetch } from '@/lib/apiClient';
import { alertError, toastSuccess } from '@/lib/alerts';
import { primaryRoleName, isManagerRole, staffStatusBadgeLabel } from '@/lib/roleUtils';
import AppShell from '@/components/AppShell';
import AvatarUpload from '@/components/AvatarUpload';
import FileLink from '@/components/FileLink';
import RevealableField from '@/components/RevealableField';
import StatusBadge from '@/components/StatusBadge';
import Modal from '@/components/Modal';
import DateOfBirthPicker from '@/components/DateOfBirthPicker';
import { NATIONALITIES } from '@/lib/nationalities';

const SELF_FIELDS = ['phoneNumber', 'address', 'gender', 'nextOfKinName', 'nextOfKinContact'];
const ADMIN_FIELDS = [
  'fullName', 'idDocumentType', 'idDocumentNumber', 'dateOfBirth', 'position',
  'employmentType', 'dateJoined', 'nationality', 'staffId', 'status', 'staffStatus', 'lastAppraisalDate',
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString() : '—');
const label = (v) => (v ? String(v).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—');

function Field({ label: l, value }) {
  return (
    <div className="detail-item">
      <div className="label">{l}</div>
      <div className={`value${!value ? ' muted' : ''}`}>{value || 'Not provided'}</div>
    </div>
  );
}

export default function ProfilePage() {
  const { user, roles, hasPermission, refresh } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const canEditAdminFields = hasPermission('user.manage');
  const roleName = primaryRoleName(roles);
  const isManager = isManagerRole(roleName);
  const staffBadgeLabel = staffStatusBadgeLabel(roleName);

  const openEdit = () => {
    const initial = {};
    [...SELF_FIELDS, ...ADMIN_FIELDS].forEach((f) => {
      initial[f] = user[f] || '';
    });
    setForm(initial);
    setEditing(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fields = canEditAdminFields ? [...SELF_FIELDS, ...ADMIN_FIELDS] : SELF_FIELDS;
      const body = {};
      fields.forEach((f) => {
        if (form[f] !== '' && form[f] !== undefined) body[f] = form[f];
      });
      await apiFetch(`/users/${user.id}`, { method: 'PATCH', body });
      await refresh();
      toastSuccess('Profile updated');
      setEditing(false);
    } catch (err) {
      alertError('Update failed', err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return <AppShell title="My Profile" />;

  return (
    <AppShell title="My Profile">
      <div className="page-header">
        <div>
          <h1>My Profile</h1>
          <p>View and update your personal details</p>
        </div>
        <div className="page-header-actions">
          <button type="button" className="btn" onClick={openEdit}>Edit Profile</button>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <AvatarUpload
              userId={user.id}
              src={user.profilePhotoUrl}
              alt={user.fullName}
              size={72}
              fallback={<span style={{ fontWeight: 800, color: 'var(--color-primary)', fontSize: 22 }}>{(user.fullName || '?')[0]}</span>}
              onUploaded={refresh}
            />
            <div>
              <h2 style={{ fontSize: 18 }}>{user.fullName}</h2>
              <div className="subtitle">{user.email}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <StatusBadge status={user.status} />
                {staffBadgeLabel && (
                  <StatusBadge status={user.staffStatus} label={`${staffBadgeLabel}: ${label(user.staffStatus)}`} />
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="permission-category-label">Contact</div>
        <div className="detail-grid">
          <Field label="Phone number" value={user.phoneNumber} />
          <Field label="Address" value={user.address} />
        </div>

        <div className="permission-category-label">Personal Info</div>
        <div className="detail-grid">
          <Field label="Date of birth" value={fmtDate(user.dateOfBirth)} />
          <Field label="Gender" value={label(user.gender)} />
          <Field label="Nationality" value={user.nationality} />
          <div className="detail-item">
            <div className="label">ID document</div>
            <div className={`value${!user.idDocumentType ? ' muted' : ''}`}>
              {user.idDocumentType ? (
                <>
                  {label(user.idDocumentType)} —{' '}
                  <RevealableField maskedValue={user.idDocumentNumber} fetchUrl={`/users/${user.id}/id-document`} />
                </>
              ) : 'Not provided'}
            </div>
          </div>
        </div>

        {!isManager && (
          <>
            <div className="permission-category-label">Employment</div>
            <div className="detail-grid">
              <Field label="Staff ID" value={user.staffId} />
              <Field label="Position" value={user.position} />
              <Field label="Employment type" value={label(user.employmentType)} />
              <Field label="Date joined" value={fmtDate(user.dateJoined)} />
              <Field label="Last appraisal" value={fmtDate(user.lastAppraisalDate)} />
            </div>

            <div className="permission-category-label">Next of Kin</div>
            <div className="detail-grid">
              <Field label="Name" value={user.nextOfKinName} />
              <Field label="Contact number" value={user.nextOfKinContact} />
            </div>

            <div className="permission-category-label">Documents</div>
            <div className="detail-grid">
              <div className="detail-item">
                <div className="label">CV</div>
                <FileLink src={user.cvUrl}>View CV</FileLink>
              </div>
            </div>
          </>
        )}
      </div>

      {editing && form && (
        <Modal
          title="Edit Profile"
          onClose={() => setEditing(false)}
          wide
          footer={
            <>
              <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" form="edit-profile-form" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </>
          }
        >
          <form onSubmit={handleSave} id="edit-profile-form">
            <div className="permission-category-label">Contact</div>
            <div className="form-grid">
              <div className="field">
                <label>Phone number</label>
                <input name="phoneNumber" value={form.phoneNumber} onChange={handleChange} />
              </div>
              <div className="field full">
                <label>Address</label>
                <textarea name="address" rows={2} value={form.address} onChange={handleChange} />
              </div>
              <div className="field">
                <label>Gender</label>
                <select name="gender" value={form.gender} onChange={handleChange}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {!isManager && (
              <>
                <div className="permission-category-label">Next of Kin</div>
                <div className="form-grid">
                  <div className="field">
                    <label>Name</label>
                    <input name="nextOfKinName" value={form.nextOfKinName} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Contact number</label>
                    <input name="nextOfKinContact" value={form.nextOfKinContact} onChange={handleChange} />
                  </div>
                </div>
              </>
            )}

            {canEditAdminFields && (
              <>
                <div className="permission-category-label">Personal Info (Admin)</div>
                <div className="form-grid">
                  <div className="field">
                    <label>Full name</label>
                    <input name="fullName" value={form.fullName} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label>Nationality</label>
                    <select name="nationality" value={form.nationality} onChange={handleChange}>
                      <option value="">Select...</option>
                      {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>ID document type</label>
                    <select name="idDocumentType" value={form.idDocumentType} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="ic">IC (local)</option>
                      <option value="passport">Passport (foreign)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>ID document number</label>
                    <input name="idDocumentNumber" value={form.idDocumentNumber} onChange={handleChange} />
                  </div>
                  <div className="field full">
                    <label>Date of birth</label>
                    <DateOfBirthPicker value={form.dateOfBirth} onChange={(v) => setForm((p) => ({ ...p, dateOfBirth: v }))} idPrefix="dob-edit" />
                  </div>
                </div>

                {!isManager && (
                  <>
                    <div className="permission-category-label">Employment (Admin)</div>
                    <div className="form-grid">
                      <div className="field">
                        <label>Staff ID</label>
                        <input name="staffId" value={form.staffId} onChange={handleChange} />
                      </div>
                      <div className="field">
                        <label>Position</label>
                        <input name="position" value={form.position} onChange={handleChange} />
                      </div>
                      <div className="field">
                        <label>Employment type</label>
                        <select name="employmentType" value={form.employmentType} onChange={handleChange}>
                          <option value="">Select...</option>
                          <option value="full_time">Full-time</option>
                          <option value="part_time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Account status</label>
                        <select name="status" value={form.status} onChange={handleChange}>
                          <option value="pending">Pending</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </div>
                      <div className="field">
                        <label>Staff status</label>
                        <select name="staffStatus" value={form.staffStatus} onChange={handleChange}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                      <div className="field full">
                        <label>Date joined</label>
                        <DateOfBirthPicker value={form.dateJoined} onChange={(v) => setForm((p) => ({ ...p, dateJoined: v }))} idPrefix="joined-edit" />
                      </div>
                      <div className="field full">
                        <label>Last appraisal date</label>
                        <DateOfBirthPicker value={form.lastAppraisalDate} onChange={(v) => setForm((p) => ({ ...p, lastAppraisalDate: v }))} idPrefix="appraisal-edit" />
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
