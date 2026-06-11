import React, { useState } from 'react';

export default function MockPaystack({ checkoutData, onComplete, onCancel }) {
  const { reference, amount, nominee, votes } = checkoutData;
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState('MTN'); // MTN, Telecel, AirtelTigo
  const [isSuccess, setIsSuccess] = useState(false);
  const [phone, setPhone] = useState(checkoutData.phone || '');

  const getNetworkStyle = (net, isActive) => {
    if (!isActive) {
      return {
        padding: '0.6rem 0.5rem',
        fontSize: '0.65rem',
        background: 'transparent',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-color)',
        flex: 1,
        transition: 'var(--transition-fast)'
      };
    }
    
    if (net === 'MTN') {
      return {
        padding: '0.6rem 0.5rem',
        fontSize: '0.65rem',
        background: '#fffdf0',
        color: '#b89200',
        borderColor: '#ffcc00',
        boxShadow: '0 0 0 2px rgba(255, 204, 0, 0.15)',
        fontWeight: 'bold',
        flex: 1,
        transition: 'var(--transition-fast)'
      };
    }
    if (net === 'Telecel') {
      return {
        padding: '0.6rem 0.5rem',
        fontSize: '0.65rem',
        background: '#fff5f5',
        color: '#c00',
        borderColor: '#e60000',
        boxShadow: '0 0 0 2px rgba(230, 0, 0, 0.15)',
        fontWeight: 'bold',
        flex: 1,
        transition: 'var(--transition-fast)'
      };
    }
    return {
      padding: '0.6rem 0.5rem',
      fontSize: '0.65rem',
      background: '#f0f5fa',
      color: '#0054A6',
      borderColor: '#0070e0',
      boxShadow: '0 0 0 2px rgba(0, 112, 224, 0.15)',
      fontWeight: 'bold',
      flex: 1,
      transition: 'var(--transition-fast)'
    };
  };

  const triggerPaymentSuccess = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/payment/mock-verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reference }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to authorize mock transaction');
      }
      setIsSuccess(true);
    } catch (err) {
      alert(err.message || 'Payment confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="luxury-modal-overlay">
      <div className="luxury-modal" style={{ maxWidth: '480px' }}>
        <div className="luxury-modal-header" style={{ background: 'var(--text-primary)', color: '#fff', borderBottom: 'none' }}>
          <h2 style={{ fontSize: '0.9rem', color: '#fff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            {isSuccess ? 'VOTE CONFIRMED' : 'SECURE MOBILE MONEY PAYMENT'}
          </h2>
        </div>
        
        {isSuccess ? (
          /* Success Screen Drawer Panel */
          <div className="luxury-modal-body" style={{ textAlign: 'center', padding: '3rem 2.5rem' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: 'var(--accent-light)',
              color: 'var(--accent-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.6rem',
              margin: '0 auto 1.5rem auto',
              fontWeight: 'bold'
            }}>
              ✓
            </div>
            <h2 style={{ fontSize: '1.4rem', fontFamily: 'var(--font-serif)', fontWeight: 400, marginBottom: '0.75rem', color: 'var(--text-primary)' }}>
              Votes Cast Successfully
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2.5rem', lineHeight: '1.5' }}>
              Your transaction was authorized successfully. We have added <strong>{votes} votes</strong> to the tally for <strong>{nominee}</strong>.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <button
                onClick={() => onComplete(true, { nomineeId: checkoutData.nomineeId, nomineeName: nominee, voteAgain: true })}
                className="luxury-btn"
                style={{ padding: '0.9rem', fontSize: '0.75rem', letterSpacing: '0.1em' }}
              >
                CAST MORE VOTES FOR {nominee.toUpperCase()}
              </button>
              <button
                onClick={() => onComplete(true, { voteAgain: false })}
                className="luxury-btn secondary"
                style={{ padding: '0.75rem', fontSize: '0.75rem' }}
              >
                RETURN TO LIST
              </button>
            </div>
          </div>
        ) : (
          /* Mobile Money Input Form */
          <div className="luxury-modal-body">
            {/* Billing Overview */}
            <div style={{ 
              background: 'var(--bg-tertiary)', 
              border: '1px solid var(--border-color)', 
              padding: '1.25rem', 
              marginBottom: '1.5rem', 
              fontSize: '0.8rem' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                <span>MERCHANT:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>VOTEEQ AWARDS</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                <span>ORDER REFERENCE:</span>
                <span style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{reference}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                borderTop: '1px solid var(--border-color)', 
                paddingTop: '0.75rem', 
                marginTop: '0.75rem', 
                fontSize: '1rem',
                fontWeight: 500 
              }}>
                <span>TOTAL AMOUNT DUE:</span>
                <span style={{ color: 'var(--accent-dark)' }}>GHS {parseFloat(amount).toFixed(2)}</span>
              </div>
            </div>

            <p style={{ fontSize: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              You are authorizing a Mobile Money payment of <strong style={{ color: 'var(--text-primary)' }}>{votes} votes</strong> for nominee <strong style={{ color: 'var(--text-primary)' }}>{nominee}</strong>.
            </p>

            {/* Mobile Money Payment form panel */}
            <div style={{ marginBottom: '1.5rem', border: '1px solid var(--border-color)', padding: '1.25rem', background: '#fafafa' }}>
              <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Select Network Provider
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                {['MTN', 'Telecel', 'AirtelTigo'].map(net => (
                  <button 
                    key={net} 
                    type="button" 
                    onClick={() => setProvider(net)}
                    className="luxury-btn secondary"
                    style={getNetworkStyle(net, provider === net)}
                  >
                    <span style={{ 
                      display: 'inline-block',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      marginRight: '0.4rem',
                      background: net === 'MTN' ? '#ffcc00' : (net === 'Telecel' ? '#e60000' : '#0070e0')
                    }} />
                    {net}
                  </button>
                ))}
              </div>
              
              <label style={{ display: 'block', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>
                Phone Number
              </label>
              <input 
                type="tel" 
                placeholder="Mobile Money Number (024xxxxxxx)" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="luxury-input" 
                style={{ fontSize: '0.8rem' }}
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <button
                onClick={triggerPaymentSuccess}
                disabled={loading}
                className="luxury-btn"
                style={{ padding: '1rem', fontSize: '0.8rem', letterSpacing: '0.12em' }}
              >
                {loading ? (
                  <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <svg className="animate-spin" style={{ width: '16px', height: '16px' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    PROCESSING TRANSACTION...
                  </span>
                ) : (
                  'AUTHORIZE PAYMENT'
                )}
              </button>
              <button
                onClick={onCancel}
                disabled={loading}
                className="luxury-btn secondary"
                style={{ padding: '0.75rem', fontSize: '0.75rem' }}
              >
                CANCEL PAYMENT
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
