import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../config';
import { BRANDING } from '../branding';
import TicketQrCode from '../components/TicketQrCode';

export default function PaymentStatusPage({ onBack, onGoToVote, onGoToTickets }) {
  const getQueryParam = (name) => {
    const hash = window.location.hash;
    const searchIdx = hash.indexOf('?');
    if (searchIdx !== -1) {
      const searchParams = new URLSearchParams(hash.substring(searchIdx));
      if (searchParams.has(name)) {
        return searchParams.get(name);
      }
    }
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  };

  const [reference] = useState(() => getQueryParam('reference') || getQueryParam('trxref') || '');
  const [statusToken] = useState(() => getQueryParam('token') || getQueryParam('statusToken') || '');
  const [status, setStatus] = useState(() => reference ? 'loading' : 'error');
  const [details, setDetails] = useState(null);
  const [type, setType] = useState('');
  const [emailNotice, setEmailNotice] = useState('');
  const printTriggered = useRef(false);
  const [errorMsg, setErrorMsg] = useState(() => {
    if (!getQueryParam('reference') && !getQueryParam('trxref')) return 'No payment reference found in the URL.';
    if (!getQueryParam('token') && !getQueryParam('statusToken')) return 'Missing payment verification token in the URL.';
    return '';
  });

  const verifyPayment = async (refStr) => {
    if (!refStr) return;
    setStatus('loading');
    try {
      const token = statusToken || getQueryParam('token') || getQueryParam('statusToken');
      const res = await fetch(`${API_BASE_URL}/api/payment/status/${refStr}?token=${encodeURIComponent(token || '')}`);
      if (res.ok) {
        const data = await res.json();
        const normalizedStatus = data.status === 'paid' ? 'completed' : data.status;
        setStatus(normalizedStatus);
        setDetails(data.details);
        setType(data.type);
        if (normalizedStatus === 'completed' && data.details?.email) {
          setEmailNotice(`A copy of this receipt was sent to ${data.details.email}.`);
        }
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
    if (reference && statusToken) {
      verifyPayment(reference);
    } else if (reference && !statusToken) {
      setStatus('error');
    }
  }, [reference, statusToken]);

  useEffect(() => {
    if (status === 'completed' && details && !printTriggered.current) {
      printTriggered.current = true;
      const timer = setTimeout(() => window.print(), 800);
      return () => clearTimeout(timer);
    }
  }, [status, details]);

  const isSuccess = status === 'completed';

  return (
    <div className="payment-status-page" style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1.5rem' }}>
      <button onClick={onBack} className="luxury-btn secondary no-print" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '3rem', textAlign: 'center' }}>
        <span className="ref-badge no-print" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>Payment Verification</span>

        {status === 'loading' && (
          <div style={{ padding: '2rem 0' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 1.5rem auto', width: '40px', height: '40px', border: '3px solid rgba(var(--accent-rgb), 0.1)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Verifying payment status with the network...</p>
          </div>
        )}

        {isSuccess && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Payment Successful
            </h1>
            <p className="no-print" style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem', lineHeight: 1.6 }}>
              Your transaction has been processed and confirmed. Thank you for your support.
            </p>
            {emailNotice && (
              <p className="no-print" style={{ fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1.5rem' }}>
                {emailNotice}
              </p>
            )}

            {details && (
              <div id="payment-receipt-print" className="payment-receipt-card" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(var(--accent-rgb), 0.2)', borderRadius: '8px', padding: '1.5rem', textAlign: 'left', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                <div style={{ borderBottom: '1px dashed rgba(var(--accent-rgb), 0.2)', paddingBottom: '0.75rem', marginBottom: '0.75rem', fontWeight: 'bold', letterSpacing: '0.05em', color: 'var(--accent)' }}>
                  {type === 'vote' ? 'OFFICIAL VOTE RECEIPT' : type === 'ticket' ? 'OFFICIAL TICKET RECEIPT' : 'REGISTRATION PAYMENT'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                  <div>Reference:</div>
                  <div style={{ color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>{reference}</div>

                  {details.email && (
                    <>
                      <div>Email:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.email}</div>
                    </>
                  )}

                  {type === 'vote' && (
                    <>
                      <div>Nominee:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.nominee_name}</div>
                      <div>Votes cast:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.vote_count}</div>
                    </>
                  )}

                  {type === 'ticket' && (
                    <>
                      <div>Event:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.event_title}</div>
                      <div>Quantity:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.quantity}</div>
                      <div>Ticket code:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right', fontFamily: 'monospace', fontWeight: 'bold' }}>{details.ticket_code}</div>
                    </>
                  )}

                  {type === 'nominee_registration' && (
                    <>
                      <div>Applicant:</div>
                      <div style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{details.name}</div>
                    </>
                  )}

                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>Amount paid:</div>
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)', color: 'var(--accent)', fontWeight: 'bold', textAlign: 'right' }}>
                    GH₵ {Number(details.amount).toFixed(2)}
                  </div>
                </div>
                {type === 'ticket' && details.ticket_code && (
                  <div style={{ textAlign: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed rgba(var(--accent-rgb), 0.2)' }}>
                    <TicketQrCode value={details.ticket_code} size={140} />
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>Present this QR code or ticket code at the door.</p>
                  </div>
                )}
                <p style={{ marginTop: '1rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {BRANDING.platformName} · {BRANDING.eventTitle} · {new Date(details.timestamp || Date.now()).toLocaleString()}
                </p>
              </div>
            )}

            <button type="button" onClick={() => window.print()} className="luxury-btn no-print" style={{ width: '100%', marginBottom: '1rem' }}>
              PRINT RECEIPT
            </button>
          </div>
        )}

        {status === 'pending' && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Transaction Pending
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              We are awaiting payment confirmation. This usually takes a few seconds after Paystack completes.
            </p>
            <button onClick={() => verifyPayment(reference)} disabled={!reference} className="luxury-btn no-print" style={{ width: '100%', marginBottom: '1rem' }}>
              RETRY VERIFICATION
            </button>
          </div>
        )}

        {(status === 'failed' || status === 'error') && (
          <div style={{ animation: 'fadeIn 0.6s ease' }}>
            <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              Verification Failed
            </h1>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
              {errorMsg || 'The payment verification could not be completed successfully, or the transaction was declined.'}
            </p>
            <button onClick={() => verifyPayment(reference)} disabled={!reference} className="luxury-btn no-print" style={{ width: '100%', marginBottom: '1rem' }}>
              RETRY VERIFICATION
            </button>
          </div>
        )}

        <div className="no-print" style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={onGoToVote} className="luxury-btn secondary" style={{ flex: 1, fontSize: '0.75rem' }}>
            VOTE PORTAL
          </button>
          <button onClick={onGoToTickets} className="luxury-btn secondary" style={{ flex: 1, fontSize: '0.75rem' }}>
            {BRANDING.ticketsEnabled ? 'BUY TICKETS' : 'TICKETS (NOT OPEN)'}
          </button>
        </div>
      </div>
    </div>
  );
}
