import { useState } from 'react';
import { API_BASE_URL } from '../config';
import { getGhanaPhoneError, normalizeGhanaPhone } from '../utils/phone';
import { getEmailError, normalizeEmail } from '../utils/email';

export default function VoteModal({ nominee, onClose, onPaymentRedirect }) {
  const [voteCount, setVoteCount] = useState(10);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [numA, setNumA] = useState(() => Math.floor(2 + Math.random() * 8));
  const [numB, setNumB] = useState(() => Math.floor(2 + Math.random() * 8));
  const [captchaInput, setCaptchaInput] = useState('');

  const voteShortcuts = [5, 10, 25, 50, 100];
  const pricePerVote = 1; // 1 GH₵ per vote

  const MAX_VOTES = 10000;
  const parsedVotes = Math.min(parseInt(voteCount) || 0, MAX_VOTES);
  const isInvalidVotes = parsedVotes <= 0 || isNaN(parseInt(voteCount)) || parseFloat(voteCount) !== parseInt(voteCount);

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    const phoneError = getGhanaPhoneError(phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    const normalizedPhone = normalizeGhanaPhone(phone);
    const emailError = getEmailError(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const normalizedEmail = normalizeEmail(email);
    if (isInvalidVotes) {
      setError('Please choose a valid whole number of votes (minimum 1)');
      return;
    }
    const correctAnswer = numA + numB;
    if (parseInt(captchaInput) !== correctAnswer) {
      setError('Incorrect CAPTCHA verification answer. Please try again.');
      setNumA(Math.floor(2 + Math.random() * 8));
      setNumB(Math.floor(2 + Math.random() * 8));
      setCaptchaInput('');
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
          email,
          phone: normalizedPhone,
          email: normalizedEmail,
          voteCount,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Payment initialization failed');
      }

      onPaymentRedirect({
        ...data,
        amount: parsedVotes * pricePerVote,
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
              src={nominee.photo_url} 
              alt={nominee.name} 
              style={{
                width: '70px',
                height: '85px',
                objectFit: 'cover',
                border: 'var(--border-width) solid var(--border-color)'
              }}
            />
            <div>
              <span className="ref-badge" style={{ marginBottom: '0.4rem' }}>
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
            {/* Votes shortcut buttons and Custom count input */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                Select Vote Count
              </label>
              
              <div className="vote-shortcut-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {voteShortcuts.map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setVoteCount(num)}
                    className="luxury-btn secondary"
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.75rem',
                      background: voteCount === num ? 'var(--accent)' : 'transparent',
                      color: voteCount === num ? '#fff' : 'var(--text-primary)',
                      borderColor: voteCount === num ? 'var(--accent)' : 'var(--border-color)',
                      letterSpacing: '0.05em'
                    }}
                  >
                    +{num}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  max={MAX_VOTES}
                  step="1"
                  inputMode="numeric"
                  value={voteCount}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Allow empty for clearing, but cap at MAX_VOTES
                    if (val === '') { setVoteCount(''); return; }
                    const num = parseInt(val);
                    if (!isNaN(num) && num <= MAX_VOTES) setVoteCount(num);
                  }}
                  className="luxury-input"
                  style={{ 
                    width: '110px', 
                    padding: '0.6rem 0.75rem',
                    borderColor: isInvalidVotes ? 'rgba(230, 0, 0, 0.4)' : 'var(--border-color)',
                    boxShadow: isInvalidVotes ? '0 0 0 2px rgba(230, 0, 0, 0.05)' : 'none'
                  }}
                />
                <span style={{ fontSize: '0.8rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  votes
                </span>
              </div>
              {isInvalidVotes && voteCount !== '' && (
                <p style={{ color: '#c00', fontSize: '0.65rem', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
                  Please enter a valid whole number of votes (minimum 1).
                </p>
              )}
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

            {/* Invoice email */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Email Address (Required for receipt)
              </label>
              <input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="luxury-input"
              />
            </div>

            {/* Anti-Bot Arithmetic Validation */}
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Anti-Bot Verification
              </label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <div style={{
                  padding: '0.6rem 1rem',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.05em',
                  color: 'var(--text-primary)',
                  userSelect: 'none'
                }}>
                  {numA} + {numB} =
                </div>
                <input
                  type="text"
                  required
                  pattern="\d*"
                  inputMode="numeric"
                  placeholder="Answer"
                  value={captchaInput}
                  onChange={(e) => setCaptchaInput(e.target.value)}
                  className="luxury-input"
                  style={{ flex: 1, padding: '0.6rem 0.75rem' }}
                />
              </div>
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
                  Rate per vote
                </span>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  GH₵ {pricePerVote.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: 'right', minWidth: 0 }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Total cost due
                </span>
                <p style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', marginTop: '0.15rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  GH₵ {(parsedVotes * pricePerVote).toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isInvalidVotes || !phone || !email.trim()}
              className={`luxury-btn ${(loading || isInvalidVotes || !phone || !email.trim()) ? 'disabled' : ''}`}
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
