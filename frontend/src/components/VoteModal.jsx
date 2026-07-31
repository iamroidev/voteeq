import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { BRANDING } from '../branding';
import { getGhanaPhoneError, normalizeGhanaPhone } from '../utils/phone';
import { getEmailError, normalizeEmail } from '../utils/email';
import { calculatePaystackCheckout } from '../utils/paystackFees';
import { nomineePhotoSrc } from '../utils/photoUrl';

const VOTE_PACKAGES = [
  { votes: 50, price: 30 },
  { votes: 100, price: 60 },
  { votes: 200, price: 120 },
  { votes: 400, price: 200 },
  { votes: 600, price: 350 },
  { votes: 800, price: 450 },
  { votes: 1000, price: 500 },
  { votes: 2000, price: 1000 }
];

export function getVoteBasePrice(votes) {
  const numVotes = parseInt(votes, 10) || 0;
  if (numVotes <= 0) return 0;
  const pkg = VOTE_PACKAGES.find(p => p.votes === numVotes);
  if (pkg) return pkg.price;
  return Math.round(numVotes * 0.60 * 100) / 100;
}

export default function VoteModal({ nominee, onClose, onPaymentRedirect, triggerToast }) {
  const [voteCount, setVoteCount] = useState(50);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const MAX_VOTES = 10000;
  const parsedVotes = Math.min(parseInt(voteCount) || 0, MAX_VOTES);
  const basePrice = getVoteBasePrice(parsedVotes);
  const pricing = calculatePaystackCheckout(basePrice);
  const isInvalidVotes = parsedVotes <= 0 || isNaN(parseInt(voteCount)) || parseFloat(voteCount) !== parseInt(voteCount);

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    const phoneError = getGhanaPhoneError(phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const normalizedPhone = normalizeGhanaPhone(phone);
    
    // Automatically generate a fallback email using the phone number for billing
    const normalizedEmail = `voter-${normalizedPhone.replace(/\D/g, '')}@voteeq.online`;
    
    if (isInvalidVotes) {
      setError('Please choose a valid whole number of votes (minimum 1)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/payment/initialize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nomineeId: nominee.id,
          phone: normalizedPhone,
          email: normalizedEmail,
          voteCount: parsedVotes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      onPaymentRedirect({
        ...data,
        amount: data.amount ?? data.pricing?.totalDue ?? pricing.totalDue,
        pricing: data.pricing ?? pricing,
        nominee: nominee.name,
        nomineeId: nominee.id,
        votes: parsedVotes,
        phone: normalizedPhone
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server connection issue. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="luxury-drawer-overlay" onClick={(e) => { if (e.target.className === 'luxury-drawer-overlay') onClose(); }} role="dialog" aria-modal="true">
      <div className="luxury-drawer">
        <div className="luxury-drawer-header">
          <h2 style={{ fontSize: '1.25rem' }}>Cast Votes</h2>
          <button onClick={onClose} className="modal-close-btn" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="luxury-drawer-body">
          {/* Nominee Profile summary */}
          <div className="drawer-nominee-summary" style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', alignItems: 'center' }}>
            <img 
              src={nomineePhotoSrc(nominee.photo_url)} 
              alt={nominee.name} 
              style={{
                width: '70px',
                height: '85px',
                objectFit: 'cover',
                border: 'var(--border-width) solid var(--border-color)'
              }}
            />
            <div>
              <span
                className="ref-badge"
                onClick={() => {
                  navigator.clipboard.writeText(nominee.code).then(() => {
                    if (triggerToast) {
                      triggerToast(`Candidate code ${nominee.code} copied to clipboard!`);
                    }
                  }).catch(() => {});
                }}
                style={{ marginBottom: '0.4rem', cursor: 'pointer' }}
                title="Click to copy candidate code"
              >
                REF. {nominee.code}
              </span>
              <h3 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', fontWeight: 400, marginTop: '0.1rem' }}>
                {nominee.name}
              </h3>
              <p style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                {nominee.category_name}
              </p>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'var(--accent-light)',
              borderLeft: '3px solid var(--accent)',
              padding: '0.75rem 1rem',
              fontSize: '0.8rem',
              color: 'var(--accent-dark)',
              fontWeight: 500,
              marginBottom: '1.5rem'
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleVoteSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                Select Voting Package
              </label>

              {/* Grid of bulk packages */}
              <div className="vote-package-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.6rem',
                marginBottom: '1.25rem'
              }}>
                {VOTE_PACKAGES.map((pkg) => {
                  const isSelected = voteCount === pkg.votes;
                  return (
                    <button
                      key={pkg.votes}
                      type="button"
                      onClick={() => setVoteCount(pkg.votes)}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0.75rem 0.5rem',
                        background: isSelected ? 'var(--accent-light)' : 'var(--bg-secondary, #ffffff)',
                        border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border-color)',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: isSelected ? '0 4px 10px rgba(var(--accent-rgb), 0.12)' : 'none',
                        textAlign: 'center'
                      }}
                    >
                      <span style={{
                        fontSize: '0.95rem',
                        fontWeight: 700,
                        color: isSelected ? 'var(--accent-dark)' : 'var(--text-primary)',
                        marginBottom: '0.15rem'
                      }}>
                        GH₵ {pkg.price.toFixed(2)}
                      </span>
                      <span style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        fontWeight: 500
                      }}>
                        {pkg.votes} votes
                      </span>
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Mobile Money Details */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Mobile Money Phone (Required)
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 0244123456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="luxury-input"
              />
            </div>

            {/* Pricing Summary card */}
            <div
              className="vote-pricing-summary"
              style={{
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              marginBottom: '2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              overflow: 'hidden'
            }}>
              <div style={{ flexShrink: 0 }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Base Amount
                </span>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  GH₵ {pricing.baseAmount.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Total cost due
                </span>
                <p style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  GH₵ {pricing.totalDue.toFixed(2)}
                </p>
            </div>

            <button
              type="submit"
              disabled={loading || isInvalidVotes || !phone}
              className={`luxury-btn ${(loading || isInvalidVotes || !phone) ? 'disabled' : ''}`}
              style={{ width: '100%', padding: '1.1rem', fontSize: '0.8rem', letterSpacing: '0.15em' }}
            >
              {loading ? 'PROCESSING TRANSACTION...' : 'PROCEED TO SECURE CHECKOUT'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
