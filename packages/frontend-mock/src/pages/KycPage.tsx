import { useState, useEffect } from 'react';

import { kycApi, QryptoApiError, type KycStatus, type KycDocument } from '../lib/api';
import { useAuth } from '../lib/auth-context';

const KYC_STATUS_COLORS: Record<string, string> = {
  unverified: 'tag-muted',
  pending: 'tag-yellow',
  under_review: 'tag-blue',
  approved: 'tag-green',
  rejected: 'tag-red',
  rekyc_required: 'tag-yellow',
};

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'utility_bill', label: 'Utility Bill' },
  { value: 'bank_statement', label: 'Bank Statement' },
];

export function KycPage() {
  const { token } = useAuth();
  const [status, setStatus] = useState<KycStatus | null>(null);
  const [documents, setDocuments] = useState<KycDocument[]>([]);
  const [selectedType, setSelectedType] = useState('passport');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = async () => {
    if (!token) return;
    try {
      const [s, d] = await Promise.all([kycApi.getStatus(token), kycApi.getDocuments(token)]);
      setStatus(s);
      setDocuments(d);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [token]);

  const handleSubmit = async () => {
    if (!token) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await kycApi.submit(selectedType, token);
      setMessage({ type: 'success', text: 'Documents submitted — under review' });
      void load();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof QryptoApiError ? err.message : 'Submission failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState />;

  const canSubmit = status && ['unverified', 'rejected', 'rekyc_required'].includes(status.status);

  return (
    <div className="page animate-in">
      <div className="page-title">KYC Verification</div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Status card */}
        <div className="card">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            Verification Status
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span
              className={`tag ${KYC_STATUS_COLORS[status?.status ?? 'unverified'] ?? 'tag-muted'}`}
              data-testid="kyc-status"
            >
              {status?.status ?? 'unknown'}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Trading', value: status?.canTrade, testId: 'kyc-can-trade' },
              { label: 'Withdrawals', value: status?.canWithdraw, testId: 'kyc-can-withdraw' },
            ].map(({ label, value, testId }) => (
              <div
                key={label}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {label}
                </span>
                <span className={`tag ${value ? 'tag-green' : 'tag-red'}`} data-testid={testId}>
                  {value ? 'Enabled' : 'Blocked'}
                </span>
              </div>
            ))}
          </div>

          {status?.amlFlags && status.amlFlags.length > 0 && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 10px',
                background: 'var(--red-dim)',
                borderRadius: 3,
                border: '1px solid rgba(255,77,106,0.2)',
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.65rem',
                  color: 'var(--red)',
                  marginBottom: 4,
                }}
              >
                AML FLAGS ACTIVE
              </div>
              {status.amlFlags.map((f) => (
                <div
                  key={f}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-secondary)',
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit card */}
        <div className="card">
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 12,
            }}
          >
            Submit Document
          </div>

          {!canSubmit ? (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: 'var(--text-secondary)',
              }}
            >
              {status?.status === 'approved'
                ? 'Verification complete — no action required.'
                : 'Document submission not available in current state.'}
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 12 }}>
                <label
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    marginBottom: 6,
                  }}
                >
                  Document Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  data-testid="kyc-document-type"
                  aria-label="Document type"
                  style={{ width: '100%' }}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Simulated file upload */}
              <div
                style={{
                  border: '1px dashed var(--border-strong)',
                  borderRadius: 3,
                  padding: 20,
                  textAlign: 'center',
                  marginBottom: 12,
                  background: 'var(--bg-input)',
                }}
                data-testid="kyc-upload-area"
              >
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  📄 {selectedType}.jpg
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.65rem',
                    color: 'var(--text-muted)',
                    marginTop: 4,
                  }}
                >
                  Simulated upload — no real file required
                </div>
              </div>

              {message && (
                <div
                  data-testid={`kyc-${message.type}`}
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.75rem',
                    color: message.type === 'success' ? 'var(--green)' : 'var(--red)',
                    padding: '8px 12px',
                    background: message.type === 'success' ? 'var(--green-dim)' : 'var(--red-dim)',
                    borderRadius: 3,
                    marginBottom: 12,
                  }}
                >
                  {message.text}
                </div>
              )}

              <button
                onClick={() => {
                  void handleSubmit();
                }}
                disabled={submitting}
                data-testid="kyc-submit"
                style={{
                  width: '100%',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  padding: '9px 16px',
                  background: submitting ? 'var(--bg-overlay)' : 'var(--accent)',
                  color: submitting ? 'var(--text-muted)' : 'var(--text-inverse)',
                  border: 'none',
                  borderRadius: 3,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Document'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Documents list */}
      <div className="card">
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: 12,
          }}
        >
          Submitted Documents ({documents.length})
        </div>
        {documents.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              padding: '20px 0',
            }}
          >
            No documents submitted
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Type', 'Filename', 'Uploaded'].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.65rem',
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                      padding: '6px 8px',
                      textAlign: 'left',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} data-testid="kyc-document-row">
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {doc.type}
                  </td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {doc.filename}
                  </td>
                  <td
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.75rem',
                      padding: '8px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {new Date(doc.uploadedAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div
      className="page"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}
    >
      <div
        style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}
      >
        Loading...
      </div>
    </div>
  );
}
