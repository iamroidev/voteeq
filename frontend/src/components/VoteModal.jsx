import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

export default function VoteModal({ nominee, onClose, onPaymentRedirect }) {
  const [voteCount, setVoteCount] = useState(10);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const voteShortcuts = [5, 10, 25, 50, 100];
  const pricePerVote = 1; // 1 GHS per vote

  const parsedVotes = parseInt(voteCount) || 0;
  const isInvalidVotes = parsedVotes <= 0 || isNaN(parsedVotes) || parseFloat(voteCount) !== parsedVotes;

  const handleVoteSubmit = async (e) => {
    e.preventDefault();
    if (!phone) {
      setError('Mobile Money Number is required to trigger payment prompt');
      return;
    }
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
          email,
          phone,
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
        votes: parsedVotes
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Server connection issue. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="luxury-drawer-overlay" onClick={(e) => { if (e.target.className === 'luxury-drawer-overlay') onClose(); }}>
      <div className="luxury-drawer">
        <div className="luxury-drawer-header">
          <h2 style={{ fontSize: '1.25rem' }}>Cast Votes</h2>
          <button onClick={onClose} className="modal-close-btn">
            ✕
          </button>
        </div>
        <div className="luxury-drawer-body">
          {/* Nominee Profile summary */}
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', alignItems: 'center' }}>
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
              
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
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
                  step="1"
                  value={voteCount}
                  onChange={(e) => setVoteCount(e.target.value)}
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
                Email Address (Optional)
              </label>
              <input
                type="email"
                placeholder="voter@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="luxury-input"
              />
            </div>

            {/* Pricing Summary card */}
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              padding: '1.25rem',
              marginBottom: '2rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Rate per vote
                </span>
                <p style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                  GHS {pricePerVote.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  Total cost due
                </span>
                <p style={{ fontSize: '1.6rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', marginTop: '0.15rem' }}>
                  GHS {(parsedVotes * pricePerVote).toFixed(2)}
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="luxury-btn"
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
