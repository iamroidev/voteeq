import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { API_BASE_URL } from '../config';

const BannerGenerator = lazy(() => import('./BannerGenerator'));

export default function NomineeDashboard({ code, token, onLogout, copyShareLink, dialUssdCode, wsTrigger }) {
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [bannerVersion, setBannerVersion] = useState(() => Date.now());
  const [showBannerStudio, setShowBannerStudio] = useState(false);
  const abortRef = useRef(null);
  const wsTriggerRef = useRef(wsTrigger);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const loadDashboardData = useCallback(async ({ isInitial = false, bustBannerCache = false } = {}) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    if (isInitial) {
      setInitialLoading(true);
    } else {
      setRefreshing(true);
    }

    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/nominees/dashboard/${encodeURIComponent(code)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal: controller.signal,
      });
      const resData = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          onLogoutRef.current();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error(resData.error || 'Failed to load dashboard metrics');
      }
      setData(resData);
      setError('');
      if (bustBannerCache) {
        setBannerVersion(Date.now());
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        if (abortRef.current === controller) {
          setError('Dashboard request timed out. Check your connection and try again.');
        }
      } else {
        console.error(err);
        setError(err.message || 'Error updating dashboard metrics');
      }
    } finally {
      clearTimeout(timeoutId);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setInitialLoading(false);
      setRefreshing(false);
    }
  }, [code, token]);

  useEffect(() => {
    loadDashboardData({ isInitial: true, bustBannerCache: true });
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadDashboardData();
      }
    }, 60000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [loadDashboardData]);

  useEffect(() => {
    if (wsTriggerRef.current === wsTrigger) return;
    wsTriggerRef.current = wsTrigger;
    loadDashboardData();
  }, [wsTrigger, loadDashboardData]);

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '6rem 0' }}>
        <h2 className="loading-copy" style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
          Loading dashboard...
        </h2>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="editorial-sheet" style={{ maxWidth: '600px', margin: '3rem auto', textAlign: 'center' }}>
        <h2 style={{ color: 'var(--accent-dark)', marginBottom: '1rem' }}>Secure Access Failure</h2>
        <p style={{ marginBottom: '2rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{error}</p>
        <button onClick={() => loadDashboardData({ isInitial: true })} className="luxury-btn secondary" style={{ marginRight: '0.75rem' }}>
          Retry
        </button>
        <button onClick={onLogout} className="luxury-btn">Back to Portal</button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { nominee, recentVotes, channelStats } = data;
  const totalVotes = nominee.votes_count;
  const webPercentage = totalVotes > 0 ? Math.round((channelStats.web / totalVotes) * 100) : 0;
  const ussdPercentage = totalVotes > 0 ? Math.round((channelStats.ussd / totalVotes) * 100) : 0;

  return (
    <div>
      {/* Header Profile Info card */}
      <div className="dashboard-profile-card">
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
              OFFICIAL USSD SHORTCODE:{' '}
              <button
                onClick={() => dialUssdCode && dialUssdCode(`*920*566*${nominee.code}#`)}
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
                *920*566*{nominee.code}#
              </button>
            </p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => loadDashboardData()} disabled={refreshing} className={`luxury-btn secondary ${refreshing ? 'disabled' : ''}`} style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem' }}>
            {refreshing ? 'REFRESHING...' : 'REFRESH'}
          </button>
        </div>
      </div>

      {/* Shareable Nominee Direct Link Block */}
      <div className="dashboard-share-card">
        <div style={{ flex: '1', minWidth: '280px' }}>
          <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-serif)', marginBottom: '0.25rem' }}>
            Direct Shareable voting link
          </h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Share this link directly on social media so fans can vote for you with one click.
          </p>
        </div>
        
        <div className="dashboard-share-input-group">
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
      <div className="dashboard-analytics-grid">
        <div className="editorial-sheet" style={{ margin: 0, position: 'relative' }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Total Votes
          </span>
          <p style={{ fontSize: '3.6rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', margin: '0.5rem 0' }}>
            {totalVotes.toLocaleString()}
          </p>
          <div style={{ height: '2px', background: 'var(--border-color)', overflow: 'hidden' }}>
            <div className="metric-progress-fill" style={{ height: '100%', background: 'var(--accent)', width: '100%' }}></div>
          </div>
          <p style={{ fontSize: '0.65rem', letterSpacing: '0.05em', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 2s infinite' }} />
            UPDATED IN REAL-TIME
          </p>
        </div>

        <div className="editorial-sheet" style={{ margin: 0 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
            Voting Methods
          </span>
          <div style={{ margin: '1rem 0 0 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>ONLINE VOTING</span>
              <span>{channelStats.web} ({webPercentage}%)</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border-color)', marginBottom: '1.25rem', overflow: 'hidden' }}>
              <div className="metric-progress-fill" style={{ height: '100%', background: 'var(--accent)', width: `${webPercentage}%`, transition: 'width 1s cubic-bezier(0.25, 1, 0.5, 1)' }}></div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.35rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>MOBILE SHORTCODE</span>
              <span>{channelStats.ussd} ({ussdPercentage}%)</span>
            </div>
            <div style={{ height: '4px', background: 'var(--border-color)', overflow: 'hidden' }}>
              <div className="metric-progress-fill" style={{ height: '100%', background: 'var(--text-primary)', width: `${ussdPercentage}%`, transition: 'width 1s cubic-bezier(0.25, 1, 0.5, 1)' }}></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left is Banner generator, Right is recent voters logs */}
      <div className="dashboard-main-grid">
        {/* Campaign Banner studio */}
        <div>
          {data?.hasCustomBanner && (
            <div className="editorial-sheet" style={{ marginBottom: '2rem', padding: '2.5rem', textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-serif)', marginBottom: '0.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                Active Campaign Poster
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                This is the live card currently configured as your social media link preview.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                <img 
                  src={`${API_BASE_URL}/banners/${code}.png?t=${bannerVersion}`} 
                  alt="Active Share Card" 
                  style={{
                    width: '100%',
                    maxWidth: '320px',
                    height: 'auto',
                    borderRadius: '8px',
                    boxShadow: '0 15px 35px rgba(0,0,0,0.18)',
                    border: '1px solid var(--border-color)',
                  }} 
                />
              </div>
              <div style={{ 
                background: '#e2f9eb', 
                borderLeft: '3px solid #2ecc71', 
                padding: '0.75rem 1rem', 
                fontSize: '0.8rem', 
                color: '#27ae60', 
                marginTop: '1rem', 
                fontWeight: 500,
                textAlign: 'left',
                borderRadius: '4px'
              }}>
                Active campaign poster is successfully saved to the server. Create a new poster below to overwrite it.
              </div>
            </div>
          )}
          {showBannerStudio ? (
            <Suspense fallback={<div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loading poster studio...</div>}>
              <BannerGenerator
                nominee={nominee}
                token={token}
                onSaveSuccess={() => {
                  setData(prev => ({ ...prev, hasCustomBanner: true }));
                  setBannerVersion(Date.now());
                }}
              />
            </Suspense>
          ) : (
            <div className="editorial-sheet" style={{ padding: '2rem', textAlign: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '0.75rem' }}>Campaign Poster Studio</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                Build and download shareable posters. Opens on demand so your dashboard stays fast.
              </p>
              <button type="button" onClick={() => setShowBannerStudio(true)} className="luxury-btn" style={{ padding: '0.75rem 1.5rem', fontSize: '0.7rem' }}>
                Open Poster Studio
              </button>
            </div>
          )}
        </div>

        {/* Live Vote Log sheet */}
        <div className="editorial-sheet" style={{ margin: 0, padding: '2.5rem' }}>
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
