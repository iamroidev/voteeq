import React, { useState, useEffect } from 'react';
import BannerGenerator from './BannerGenerator';

export default function NomineeDashboard({ code, token, onLogout, copyShareLink, dialUssdCode }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboardData = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/nominees/dashboard/${code}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to load dashboard metrics');
      }
      setData(resData);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error updating dashboard metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, [code, token]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Verifying credentials...
        </h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editorial-sheet" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--accent-dark)', marginBottom: '1rem' }}>Secure Access Failure</h2>
        <p style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{error}</p>
        <button onClick={onLogout} className="luxury-btn">Back to Portal</button>
      </div>
    );
  }

  const { nominee, recentVotes, channelStats } = data;
  const totalVotes = nominee.votes_count;
  const webPercentage = totalVotes > 0 ? Math.round((channelStats.web / totalVotes) * 100) : 0;
  const ussdPercentage = totalVotes > 0 ? Math.round((channelStats.ussd / totalVotes) * 100) : 0;

  return (
    <div>
      {/* Header Profile Info card */}
      <div className="editorial-sheet" style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '2rem', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        marginBottom: '2.5rem',
        padding: '2.5rem 3rem'
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <img 
            src={nominee.photo_url} 
            alt={nominee.name} 
            style={{
              width: '90px',
              height: '110px',
              objectFit: 'cover',
              border: 'var(--border-width) solid var(--border-color)'
            }}
          />
          <div>
            <span className="ref-badge" style={{ marginBottom: '0.4rem' }}>
              REF. {nominee.code} // {nominee.category_name}
            </span>
            <h1 style={{ fontSize: '2.2rem', fontFamily: 'var(--font-serif)', fontWeight: 400, marginTop: '0.1rem' }}>
              {nominee.name}
            </h1>
            <p style={{ fontSize: '0.75rem', marginTop: '0.4rem', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
              DIAL SHORTCODE DIRECT:{' '}
              <button
                onClick={() => dialUssdCode && dialUssdCode(`*920*102*${nominee.code}#`)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: 'var(--accent-dark)',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  transition: 'var(--transition-fast)'
                }}
                onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--accent-dark)'}
                title="Dial shortcode automatically"
              >
                *920*102*{nominee.code}#
              </button>
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={loadDashboardData} className="luxury-btn secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem' }}>
            REFRESH
          </button>
          <button onClick={onLogout} className="luxury-btn secondary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem' }}>
            LOGOUT PORTAL
          </button>
        </div>
      </div>

      {/* Shareable Nominee Direct Link Block */}
      <div className="editorial-sheet" style={{ 
        padding: '2rem 3rem', 
        marginBottom: '2.5rem',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '1.5rem',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ flex: '1', minWidth: '280px' }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', marginBottom: '0.25rem' }}>
            Direct Shareable voting link
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Share this link directly on social media so fans can vote for you with one click.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', minWidth: '320px', flex: '1' }}>
          <input
            type="text"
            readOnly
            value={`${window.location.origin}/?nominee=${nominee.code}`}
            className="luxury-input"
            style={{ 
              fontSize: '0.75rem', 
              background: 'var(--bg-primary)', 
              fontFamily: 'monospace',
              border: '1px solid var(--border-color)' 
            }}
          />
          <button
            onClick={() => copyShareLink(nominee.code, nominee.name)}
            className="luxury-btn"
            style={{ padding: '0 1.5rem', fontSize: '0.7rem' }}
          >
            COPY
          </button>
        </div>
      </div>

      {/* Analytics grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2.5rem', marginBottom: '3rem' }}>
        <div className="editorial-sheet" style={{ padding: '2rem 2.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Total Votes
          </span>
          <p style={{ fontSize: '3.6rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', margin: '0.5rem 0' }}>
            {totalVotes.toLocaleString()}
          </p>
          <div style={{ height: '3px', background: 'var(--bg-primary)' }}>
            <div style={{ height: '100%', background: 'var(--accent)', width: '100%' }}></div>
          </div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            UPDATED IN REAL-TIME
          </p>
        </div>

        <div className="editorial-sheet" style={{ padding: '2rem 2.5rem' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Voting Methods
          </span>
          <div style={{ margin: '1rem 0 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ONLINE VOTING</span>
              <span>{channelStats.web} ({webPercentage}%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-primary)', marginBottom: '1.25rem' }}>
              <div style={{ height: '100%', background: 'var(--accent)', width: `${webPercentage}%` }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>MOBILE SHORTCODE</span>
              <span>{channelStats.ussd} ({ussdPercentage}%)</span>
            </div>
            <div style={{ height: '8px', background: 'var(--bg-primary)' }}>
              <div style={{ height: '100%', background: 'var(--text-primary)', width: `${ussdPercentage}%` }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Banner generator, Right is recent voters logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem', alignItems: 'start' }}>
        {/* Campaign Banner studio */}
        <div>
          <BannerGenerator nominee={nominee} />
        </div>

        {/* Live Vote Log sheet */}
        <div className="editorial-sheet" style={{ padding: '2.5rem' }}>
          <h3 style={{ marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontSize: '1.4rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
            Recent Votes
          </h3>
          {recentVotes.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
              No votes logged yet. Share your USSD code or voting link to receive votes.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="luxury-table">
                <thead>
                  <tr>
                    <th>PHONE NUMBER</th>
                    <th>VOTE COUNT</th>
                    <th>METHOD</th>
                    <th>STATUS</th>
                    <th>DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVotes.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {v.voter_phone.length > 15 ? v.voter_phone.substring(0, 15) + '...' : v.voter_phone}
                      </td>
                      <td style={{ color: 'var(--accent-dark)', fontWeight: 500 }}>+{v.vote_count}</td>
                      <td>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: v.channel === 'web' ? 'var(--accent-dark)' : 'var(--text-primary)'
                        }}>
                          {v.channel === 'web' ? 'ONLINE' : 'MOBILE'}
                        </span>
                      </td>
                      <td>
                        <span style={{ 
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: v.status === 'completed' ? '#4f7c5d' : (v.status === 'failed' ? '#a94442' : 'var(--text-secondary)') 
                        }}>
                          ● {v.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {new Date(v.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
