'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { apiFetch, apiFetchForm } from '@/lib/apiClient';
import { alertError, alertSuccess } from '@/lib/alerts';
import { NATIONALITIES } from '@/lib/nationalities';
import DateOfBirthPicker from '@/components/DateOfBirthPicker';
import FileUploadField from '@/components/FileUploadField';

const initialFields = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  idDocumentType: '',
  idDocumentNumber: '',
  dateOfBirth: '',
  gender: '',
  nationality: '',
  address: '',
  nextOfKinName: '',
  nextOfKinContact: '',
  requestedTeamId: '',
};

const TABS = [
  { id: 'account', label: 'Account' },
  { id: 'personal', label: 'Personal Info' },
  { id: 'address', label: 'Address' },
  { id: 'identity', label: 'ID Document' },
  { id: 'kin', label: 'Next of Kin' },
  { id: 'team', label: 'Team' },
  { id: 'documents', label: 'Documents' },
];

export default function RegisterPage() {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [cvFile, setCvFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [teams, setTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('account');
  const [declared, setDeclared] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch('/teams/public')
      .then((data) => setTeams(data.teams || []))
      .catch(() => setTeams([])); // non-fatal — team selection is optional
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Tab content is hidden with CSS (display:none) rather than unmounted,
    // so native `required` validation on a field in a non-active tab won't
    // reliably block submission — validate the essentials by hand instead.
    if (!fields.fullName || !fields.email || !fields.password || !fields.confirmPassword) {
      alertError('Missing information', 'Please fill in your full name, email, and password on the Account tab.');
      setActiveTab('account');
      return;
    }
    if (fields.password !== fields.confirmPassword) {
      alertError('Passwords do not match', 'Please re-enter your password.');
      setActiveTab('account');
      return;
    }
    if (fields.password.length < 8) {
      alertError('Password too short', 'Password must be at least 8 characters.');
      setActiveTab('account');
      return;
    }
    if (!fields.dateOfBirth || !fields.gender || !fields.nationality) {
      alertError('Missing information', 'Please complete date of birth, gender, and nationality on the Personal Info tab.');
      setActiveTab('personal');
      return;
    }
    if (!fields.address) {
      alertError('Missing information', 'Please provide your address on the Address tab.');
      setActiveTab('address');
      return;
    }
    if (!fields.idDocumentType || !fields.idDocumentNumber) {
      alertError('Missing information', 'Please provide your ID document type and number on the ID Document tab.');
      setActiveTab('identity');
      return;
    }
    if (!fields.nextOfKinName || !fields.nextOfKinContact) {
      alertError('Missing information', 'Please provide next of kin details on the Next of Kin tab.');
      setActiveTab('kin');
      return;
    }
    if (!cvFile || !photoFile) {
      alertError('Missing information', 'Please upload both your CV and profile photo on the Documents tab.');
      setActiveTab('documents');
      return;
    }
    if (!declared) {
      alertError('Declaration required', 'Please confirm the information you provided is correct before submitting.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (key === 'confirmPassword') return;
        if (value) formData.append(key, value);
      });
      if (cvFile) formData.append('cv', cvFile);
      if (photoFile) formData.append('profilePhoto', photoFile);

      await apiFetchForm('/auth/register', formData);

      await alertSuccess(
        'Application submitted',
        'An administrator will review your request. You can log in once your account is approved.'
      );
      router.push('/login');
    } catch (err) {
      const detailText = err.details ? Object.values(err.details).flat().join(' ') : '';
      alertError('Registration failed', [err.message, detailText].filter(Boolean).join(' '));
    } finally {
      setSubmitting(false);
    }
  };

  const show = (tabId) => ({ display: activeTab === tabId ? 'block' : 'none' });

  return (
    <main className="auth-shell">
      <div className="auth-card-wrap wide">
        <div className="auth-logo">
          <Image src="/logo.png" alt="IMD HUB" width={88} height={88} priority />
        </div>

        <div className="auth-card">
          <div className="auth-brand">
            <div className="subtitle">Internal Staff Management</div>
          </div>

          <h1 className="accent">Employee Registration Form</h1>

          <form onSubmit={handleSubmit}>
            <div className="tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  className={`tab-btn${activeTab === tab.id ? ' active' : ''}`}
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {/* Account */}
              <div style={show('account')}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="fullName">
                      Full name <span className="required-star">*</span>
                    </label>
                    <input id="fullName" name="fullName" value={fields.fullName} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">
                      Email <span className="required-star">*</span>
                    </label>
                    <input id="email" name="email" type="email" value={fields.email} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="phoneNumber">Phone number</label>
                    <input id="phoneNumber" name="phoneNumber" value={fields.phoneNumber} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="password">
                      Password <span className="required-star">*</span>
                    </label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      value={fields.password}
                      onChange={handleChange}
                      minLength={8}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="confirmPassword">
                      Confirm password <span className="required-star">*</span>
                    </label>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      value={fields.confirmPassword}
                      onChange={handleChange}
                      minLength={8}
                    />
                  </div>
                </div>
              </div>

              {/* Personal Info */}
              <div style={show('personal')}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="dob-day">
                      Date of birth <span className="required-star">*</span>
                    </label>
                    <DateOfBirthPicker
                      value={fields.dateOfBirth}
                      onChange={(val) => setFields((prev) => ({ ...prev, dateOfBirth: val }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="gender">
                      Gender <span className="required-star">*</span>
                    </label>
                    <select id="gender" name="gender" value={fields.gender} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="field full">
                    <label htmlFor="nationality">
                      Nationality <span className="required-star">*</span>
                    </label>
                    <select id="nationality" name="nationality" value={fields.nationality} onChange={handleChange}>
                      <option value="">Select...</option>
                      {NATIONALITIES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div style={show('address')}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="address">
                      Address <span className="required-star">*</span>
                    </label>
                    <textarea id="address" name="address" rows={3} value={fields.address} onChange={handleChange} />
                  </div>
                </div>
              </div>

              {/* Identity Document */}
              <div style={show('identity')}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="idDocumentType">
                      Do you have a Passport or IC? <span className="required-star">*</span>
                    </label>
                    <select id="idDocumentType" name="idDocumentType" value={fields.idDocumentType} onChange={handleChange}>
                      <option value="">Select...</option>
                      <option value="ic">IC (local)</option>
                      <option value="passport">Passport (foreign)</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="idDocumentNumber">
                      NRIC / Passport No. <span className="required-star">*</span>
                    </label>
                    <input
                      id="idDocumentNumber"
                      name="idDocumentNumber"
                      value={fields.idDocumentNumber}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Next of Kin */}
              <div style={show('kin')}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="nextOfKinName">
                      Name <span className="required-star">*</span>
                    </label>
                    <input id="nextOfKinName" name="nextOfKinName" value={fields.nextOfKinName} onChange={handleChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="nextOfKinContact">
                      Contact number <span className="required-star">*</span>
                    </label>
                    <input
                      id="nextOfKinContact"
                      name="nextOfKinContact"
                      value={fields.nextOfKinContact}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              </div>

              {/* Team */}
              <div style={show('team')}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="requestedTeamId">Which team are you applying to join?</label>
                    <select id="requestedTeamId" name="requestedTeamId" value={fields.requestedTeamId} onChange={handleChange}>
                      <option value="">Not sure / let the administrator decide</option>
                      {teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div style={show('documents')}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cv">
                      CV <span className="required-star">*</span>
                    </label>
                    <FileUploadField id="cv" accept=".pdf,.doc,.docx" file={cvFile} onChange={setCvFile} />
                    <div className="hint">PDF or Word, up to 5MB.</div>
                  </div>
                  <div className="field">
                    <label htmlFor="profilePhoto">
                      Profile photo <span className="required-star">*</span>
                    </label>
                    <FileUploadField
                      id="profilePhoto"
                      accept=".jpg,.jpeg,.png,.webp"
                      file={photoFile}
                      onChange={setPhotoFile}
                    />
                    <div className="hint">JPG, PNG, or WebP, up to 2MB.</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="declare-bar">
              <label htmlFor="declare">
                <input id="declare" type="checkbox" checked={declared} onChange={(e) => setDeclared(e.target.checked)} />
                I hereby declare that the above information is correct.
              </label>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit application'}
              </button>
            </div>
          </form>

          <div className="auth-footer">
            <p>
              Already have an account? <a href="/login">Log in</a>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
