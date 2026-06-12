import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

export default function PaymentStatusPage({ onBack, onGoToVote, onGoToTickets }) {
  const getQueryParam = (name) => {
    // Check in hash first (e.g. #/payment-status?reference=tix_123)
    const hash = window.location.hash;
    const searchIdx = hash.indexOf('?');
    if (searchIdx !== -1) {
      const searchParams = new URLSearchParams(hash.substring(searchIdx));
      if (searchParams.has(name)) {
        return searchParams.get(name);
      }
    }
    // Fallback to normal URL search params
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  };

  const [reference] = useState(() => getQueryParam('reference') || '');
  const [status, setStatus] = useState(() => getQueryParam('reference') ? 'loading' : 'error');
  const [details, setDetails] = useState(null);
  const [type, setType] = useState('');
  const [errorMsg, setErrorMsg] = useState(() => getQueryParam('reference') ? '' : 'No payment reference found in the URL.');

  const verifyPayment = async (refStr) => {
    if (!refStr) return;
    setStatus('loading');
    try {
      const res = await fetch(`${API_BASE_URL}/api/payment/status/${refStr}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data.status); // 'pending', 'completed', 'failed', etc.
        setDetails(data.details);
        setType(data.type);
      } else {
        const errData = await res.json();
        setErrorMsg(errData.error || 'Failed to verify transaction status');
        setStatus('error');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Network error. Unable to verify payment status.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (reference) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      verifyPayment(reference);
    }
  }, [reference]);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '3rem', textAlign: 'center' }}>
        <span className="ref-badge" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>Payment Verification</span>

        {status === 'loading' && (
          <div style={{ padding: '2rem 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1.5rem auto', width: '40px', height: '40px', border: '3px solid rgba(var(--accent-rgb), 0.1)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Verifying payment status with the network...</p>
          </div>
        )}

        {status === 'completed' && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <div style={{ fontSize: '3.5rem', color: '#4caf50', marginBottom: '1rem' }}>✓</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Payment Successful
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              Your transaction has been processed and confirmed. Thank you for your support!
            </p>

            {details && (
              <div className="payment-receipt-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: '8px', padding: '1.5rem', textAlign: 'left', marginBottom: '2rem', fontSize: '0.85rem' }}>
                <div style={{ borderBottom: '1px dashed rgba(var(--accent-rgb), 0.2)', paddingBottom: '0.75rem', marginBottom: '0.75rem', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  {type === 'vote' ? 'OFFICIAL VOTE RECEIPT' : type === 'ticket' ? 'OFFICIAL TICKET PASS' : 'REGISTRATION PAYMENT'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <div>Reference:</div>
                  <div style={{ color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'monospace' }}>{reference}</div>
                  
                  {type === 'vote' && (
                    <>
                      <div>Nominee:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.nominee_name}</div>
                      <div>Votes Cast:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.vote_count}</div>
                    </>
                  )}

                  {type === 'ticket' && (
                    <>
                      <div>Event:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.event_title}</div>
                      <div>Quantity:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.quantity}</div>
                      <div>Ticket Code:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{details.ticket_code}</div>
                    </>
                  )}

                  {type === 'nominee_registration' && (
                    <>
                      <div>Applicant:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.name}</div>
                      <div>Email:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.email}</div>
                    </>
                  )}

                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>Amount Paid:</div>
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--accent)', fontWeight: 'bold', textAlign: 'right' }}>
                    GH₵ {Number(details.amount).toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {status === 'pending' && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <div style={{ fontSize: '3.5rem', color: '#ffb300', marginBottom: '1rem' }}>⌛</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Transaction Pending
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              We are currently awaiting payment confirmation from the processor. This might take a few moments.
            </p>
            <button onClick={() => verifyPayment(reference)} disabled={!reference} className="luxury-btn" style={{ width: '100%', marginBottom: '1rem' }}>
              RETRY VERIFICATION
            </button>
          </div>
        )}

        {(status === 'failed' || status === 'error') && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <div style={{ fontSize: '3.5rem', color: '#f44336', marginBottom: '1rem' }}>⚠</div>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Verification Failed
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              {errorMsg || 'The payment verification could not be completed successfully, or the transaction was declined.'}
            </p>
            <button onClick={() => verifyPayment(reference)} disabled={!reference} className="luxury-btn" style={{ width: '100%', marginBottom: '1rem' }}>
              RETRY VERIFICATION
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={onGoToVote} className="luxury-btn secondary" style={{ flex: 1, fontSize: '0.75rem' }}>
            VOTE PORTAL
          </button>
          <button onClick={onGoToTickets} className="luxury-btn secondary" style={{ flex: 1, fontSize: '0.75rem' }}>
            BUY TICKETS
          </button>
        </div>
      </div>
    </div>
  );
}
