'use client';

import { useState } from 'react';
import Image from 'next/image';
import { alertError, alertSuccess } from '@/lib/alerts';
import FileUploadField from '@/components/FileUploadField';
import InfoTip from '@/components/InfoTip';
import { createRefundApplication } from '@/lib/refundMockStore';

// --- Placeholder copy -------------------------------------------------
// Everything under ID_OPTIONS and the three declaration statements below is
// placeholder wording — the exact text (how to obtain each ID, the precise
// declaration/acknowledgment language, the Terms of Service content) is
// still to be provided. Structure and flow are final per the discussion;
// swap the copy in once it's ready.
const ID_OPTIONS = [
  {
    type: 'luc',
    label: 'LUC ID Number',
    title: 'New Student',
    description: "For students who haven't registered with the university yet, but have already started the process.",
    howTo: 'Don’t have one yet? Contact the admissions office to be issued a LUC ID before starting this application.',
  },
  {
    type: 'student',
    label: 'Student ID',
    title: 'Registered Student',
    description: 'For students who are already registered with the university.',
    howTo: 'Your Student ID can be found on your student card or in the student portal.',
  },
];

const TABS = [
  { id: 'details', label: 'Application Details' },
  { id: 'memo', label: 'Checkout Memo' },
  { id: 'declaration', label: 'Declaration' },
];

const initialFields = {
  idNumber: '',
  studentName: '',
  email: '',
  marketingEmail: '',
  marketingName: '',
  explanation: '',
};

const initialDeclarations = {
  signedName: '',
  agreedTerms: false,
  acknowledged: false,
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function RefundApplicationPage() {
  const [idType, setIdType] = useState(null); // null | 'luc' | 'student'
  const [activeTab, setActiveTab] = useState('details');
  const [fields, setFields] = useState(initialFields);
  const [memoFile, setMemoFile] = useState(null);
  const [declarations, setDeclarations] = useState(initialDeclarations);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null); // holds the created application once submitted

  const idLabel = idType === 'luc' ? 'LUC ID Number' : 'Student ID';

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const resetAndStartOver = () => {
    setIdType(null);
    setActiveTab('details');
    setFields(initialFields);
    setMemoFile(null);
    setDeclarations(initialDeclarations);
    setSubmitted(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Tab content is hidden with CSS rather than unmounted (same approach as
    // the staff registration form), so native `required` validation on a
    // field in a non-active tab won't reliably block submission — validate
    // by hand and jump to whichever tab needs attention.
    if (!fields.idNumber.trim() || !fields.studentName.trim()) {
      alertError('Missing information', `Please provide your ${idLabel} and name on the Application Details tab.`);
      setActiveTab('details');
      return;
    }
    if (!fields.email.trim() || !isValidEmail(fields.email.trim())) {
      alertError('Missing information', 'Please provide a valid email address on the Application Details tab.');
      setActiveTab('details');
      return;
    }
    if (!fields.marketingEmail.trim() || !isValidEmail(fields.marketingEmail.trim())) {
      alertError('Missing information', 'Please provide a valid marketing officer email on the Application Details tab.');
      setActiveTab('details');
      return;
    }
    if (!fields.marketingName.trim()) {
      alertError('Missing information', 'Please provide the marketing officer’s name on the Application Details tab.');
      setActiveTab('details');
      return;
    }
    if (!fields.explanation.trim()) {
      alertError('Missing information', 'Please provide an explanation on the Application Details tab.');
      setActiveTab('details');
      return;
    }
    if (!declarations.signedName.trim()) {
      alertError('Signature required', 'Please type your name to confirm the declaration on the Declaration tab.');
      setActiveTab('declaration');
      return;
    }
    if (declarations.signedName.trim().toLowerCase() !== fields.studentName.trim().toLowerCase()) {
      alertError('Name mismatch', 'The name you typed to confirm must match the name you entered on the Application Details tab.');
      setActiveTab('declaration');
      return;
    }
    if (!declarations.agreedTerms) {
      alertError('Declaration required', 'Please confirm you have read and agree to the Terms of Service.');
      setActiveTab('declaration');
      return;
    }
    if (!declarations.acknowledged) {
      alertError('Declaration required', 'Please confirm the final acknowledgment before submitting.');
      setActiveTab('declaration');
      return;
    }

    setSubmitting(true);
    try {
      // No backend yet — see lib/refundMockStore.js. This is enough to
      // demo/iterate on the flow; swapping it for a real POST later won't
      // change anything about the form itself.
      const application = createRefundApplication({
        idType,
        idNumber: fields.idNumber.trim(),
        studentName: fields.studentName.trim(),
        email: fields.email.trim(),
        marketingEmail: fields.marketingEmail.trim(),
        marketingName: fields.marketingName.trim(),
        explanation: fields.explanation.trim(),
        checkoutMemo: memoFile ? { name: memoFile.name } : null,
        declarations,
      });

      await alertSuccess(
        'Application submitted',
        `Reference number ${application.refNumber}. We have received your form.`
      );
      setSubmitted(application);
    } catch (err) {
      alertError('Submission failed', err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const show = (tabId) => ({ display: activeTab === tabId ? 'block' : 'none' });

  // --- Step 0: choose LUC ID vs Student ID -------------------------------
  if (!idType) {
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
            <h1 className="accent">Refund Application</h1>
            <p className="auth-hint">Select the option that applies to you to get started.</p>

            <div className="id-option-grid">
              {ID_OPTIONS.map((opt) => (
                <div key={opt.type} className="id-option-card">
                  <div className="id-option-card-title">{opt.title}</div>
                  <div className="id-option-card-label">{opt.label}</div>
                  <p className="id-option-card-desc">{opt.description}</p>
                  <p className="id-option-card-howto">{opt.howTo}</p>
                  <button type="button" onClick={() => setIdType(opt.type)}>
                    Continue with {opt.label}
                  </button>
                </div>
              ))}
            </div>

            <div className="auth-footer">
              <p>
                Questions about this process? Contact your marketing officer directly.
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // --- Confirmation screen after submission ------------------------------
  if (submitted) {
    return (
      <main className="auth-shell">
        <div className="auth-card-wrap">
          <div className="auth-logo">
            <Image src="/logo.png" alt="IMD HUB" width={88} height={88} priority />
          </div>
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <h1 className="accent">Application Submitted</h1>
            <p className="auth-hint">
              Reference number
              <br />
              <strong style={{ fontSize: 20, color: 'var(--color-text)' }}>{submitted.refNumber}</strong>
            </p>
            <p className="auth-hint">
              We have received your form. Keep your reference number for any follow-up.
            </p>
            <button type="button" onClick={resetAndStartOver}>
              Submit another application
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- Step 1: the actual application form -------------------------------
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

          <h1 className="accent">Refund Application</h1>
          <p className="auth-hint">
            {ID_OPTIONS.find((o) => o.type === idType)?.title} ({idLabel}).{' '}
            <button
              type="button"
              onClick={resetAndStartOver}
              style={{
                width: 'auto',
                display: 'inline',
                padding: 0,
                background: 'transparent',
                border: 'none',
                color: 'var(--color-primary)',
                textDecoration: 'underline',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Change
            </button>
          </p>

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
              {/* Application Details */}
              <div style={show('details')}>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="idNumber">
                      {idLabel} <span className="required-star">*</span>
                    </label>
                    <input id="idNumber" name="idNumber" value={fields.idNumber} onChange={handleFieldChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="studentName">
                      Full Name <span className="required-star">*</span>
                      <InfoTip>Enter your full name exactly as it appears on your submitted document.</InfoTip>
                    </label>
                    <input id="studentName" name="studentName" value={fields.studentName} onChange={handleFieldChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="email">
                      Email <span className="required-star">*</span>
                    </label>
                    <input id="email" name="email" type="email" value={fields.email} onChange={handleFieldChange} />
                  </div>
                  <div className="field">
                    <label htmlFor="marketingEmail">
                      Marketing Officer Email <span className="required-star">*</span>
                      <InfoTip>Make sure to enter the correct email.</InfoTip>
                    </label>
                    <input
                      id="marketingEmail"
                      name="marketingEmail"
                      type="email"
                      value={fields.marketingEmail}
                      onChange={handleFieldChange}
                    />
                    <div className="hint">Your application will be sent directly to this person for review.</div>
                  </div>
                  <div className="field">
                    <label htmlFor="marketingName">
                      Marketing Officer Name <span className="required-star">*</span>
                    </label>
                    <input id="marketingName" name="marketingName" value={fields.marketingName} onChange={handleFieldChange} />
                  </div>
                  <div className="field full">
                    <label htmlFor="explanation">
                      Explanation <span className="required-star">*</span>
                      <InfoTip>Tell us the reason you want to request a refund.</InfoTip>
                    </label>
                    <textarea
                      id="explanation"
                      name="explanation"
                      rows={4}
                      value={fields.explanation}
                      onChange={handleFieldChange}
                      placeholder="Please explain the reason for your refund request."
                    />
                  </div>
                </div>
              </div>

              {/* Checkout Memo */}
              <div style={show('memo')}>
                <div className="form-grid">
                  <div className="field full">
                    <label htmlFor="checkoutMemo">
                      Checkout Memo
                      <InfoTip>Upload your checkout memo if you already have it. See the note below if you don’t have it yet.</InfoTip>
                    </label>
                    <FileUploadField id="checkoutMemo" accept=".pdf,.jpg,.jpeg,.png" file={memoFile} onChange={setMemoFile} />
                    <div className="hint">PDF or image, up to 5MB.</div>
                  </div>
                  <div className="field full">
                    <ul className="notice-box notice-list">
                      <li>The checkout memo is optional at this stage for a Refund Application.</li>
                      <li>If you haven’t entered the country yet, you can submit without it.</li>
                      <li>You’ll be asked to provide it before your application can be finalized if you entered the country.</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Declaration */}
              <div style={show('declaration')}>
                <div className="declare-list">
                  <label className="declare-list-row">
                    <input
                      type="checkbox"
                      checked={Boolean(declarations.signedName.trim())}
                      readOnly
                      tabIndex={-1}
                    />
                    <span>
                      I,{' '}
                      <input
                        type="text"
                        className="inline-input"
                        placeholder="type your full name"
                        value={declarations.signedName}
                        onChange={(e) => setDeclarations((prev) => ({ ...prev, signedName: e.target.value }))}
                      />
                      , confirm that the information provided in this application is true and accurate.
                    </span>
                  </label>

                  <label className="declare-list-row">
                    <input
                      type="checkbox"
                      checked={declarations.agreedTerms}
                      onChange={(e) => setDeclarations((prev) => ({ ...prev, agreedTerms: e.target.checked }))}
                    />
                    <span>
                      I have read and agree to the{' '}
                      <a href="/refund/terms" target="_blank" rel="noopener noreferrer">
                        Terms of Service
                      </a>
                      .
                    </span>
                  </label>

                  <label className="declare-list-row">
                    <input
                      type="checkbox"
                      checked={declarations.acknowledged}
                      onChange={(e) => setDeclarations((prev) => ({ ...prev, acknowledged: e.target.checked }))}
                    />
                    <span>
                      I have read and acknowledge the refund application process, including that submission does
                      not guarantee approval and that processing may take time.
                    </span>
                  </label>
                </div>
              </div>
            </div>

            <div className="declare-bar">
              <div className="hint">Reference numbers are issued once you submit. Keep yours for follow-up.</div>
              <button type="submit" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
