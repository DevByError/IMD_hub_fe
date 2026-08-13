'use client';

import Image from 'next/image';

// Placeholder terms — final wording to be provided. Opened in a new tab from
// the Refund Application declaration step (see app/refund/page.js) so a
// student can read this without losing their in-progress form.
const SECTIONS = [
  {
    title: '1. Eligibility',
    body: 'This refund process applies to students who have submitted a valid LUC ID or Student ID as part of their application. All information provided must be true and accurate.',
  },
  {
    title: '2. Application Review',
    body: 'Every application passes through several stages of review (Marketing, Acceptance, and Approval) before it is forwarded to Accounts for processing. Submission of an application does not guarantee approval.',
  },
  {
    title: '3. Checkout Memo',
    body: 'A checkout memo is required to finalize any application. For LUC ID applications, it may be submitted after entering the country, but must be provided before the application can be completed.',
  },
  {
    title: '4. Processing Time',
    body: 'Processing times vary depending on the completeness of the application and the volume of requests being handled. You will be notified at each stage of the review process.',
  },
  {
    title: '5. Accuracy of Information',
    body: 'By submitting this application, you confirm that all information provided, including your personal details and explanation, is accurate to the best of your knowledge.',
  },
];

export default function RefundTermsPage() {
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
          <h1 className="accent">Refund Application: Terms of Service</h1>
          <p className="auth-hint">This is placeholder text pending final wording.</p>

          {SECTIONS.map((section) => (
            <div key={section.title} className="form-section">
              <h2>{section.title}</h2>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-text)', margin: 0 }}>{section.body}</p>
            </div>
          ))}

          <div className="auth-footer">
            <p>You can close this tab to return to your application.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
