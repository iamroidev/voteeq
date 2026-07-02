import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { API_BASE_URL } from '../config';
import { getNomineeShareUrl } from '../branding';
import { nomineePhotoSrc } from '../utils/photoUrl';
import { readImageAsDataUrl, useClipboardImagePaste } from '../utils/clipboardImage';

export default function NomineeDashboard({ code, token, onLogout, copyShareLink, dialUssdCode, wsTrigger }) {
  const [data, setData] = useState(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState('');
  const photoInputRef = useRef(null);
  const abortRef = useRef(null);
  const wsTriggerRef = useRef(wsTrigger);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

  const loadDashboardData = useCallback(async ({ isInitial = false } = {}) => {
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
    loadDashboardData({ isInitial: true });
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

  const uploadProfilePhoto = useCallback(async (file) => {
    if (!file) return;

    setPhotoUploading(true);
    setPhotoMessage('');

    try {
      const dataUrl = await readImageAsDataUrl(file);

      const response = await fetch(`${API_BASE_URL}/api/nominees/upload-photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ code, image: dataUrl }),
      });
      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update profile photo');
      }

      setData((prev) => ({
        ...prev,
        nominee: { ...prev.nominee, photo_url: resData.photo_url },
      }));
      setPhotoMessage('Profile photo updated. Fans will see this on the vote page.');
      setTimeout(() => setPhotoMessage(''), 5000);
    } catch (err) {
      console.error(err);
      setPhotoMessage(err.message || 'Could not upload photo. Try again.');
    } finally {
      setPhotoUploading(false);
    }
  }, [code, token]);

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    await uploadProfilePhoto(file);
  };

  useClipboardImagePaste({
    active: Boolean(data) && !photoUploading,
    onImage: uploadProfilePhoto,
  });

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
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <img 
              src={nomineePhotoSrc(nominee.photo_url)}
              alt={nominee.name} 
              style={{
                width: '90px',
                height: '110px',
                objectFit: 'cover',
                border: 'var(--border-width) solid var(--border-color)',
                display: 'block',
              }}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={handlePhotoUpload}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={photoUploading}
              className="luxury-btn secondary"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                padding: '0.35rem 0.5rem',
                fontSize: '0.55rem',
                letterSpacing: '0.04em',
                width: '100%',
                borderRadius: 0,
              }}
            >
              {photoUploading ? 'UPLOADING...' : 'CHANGE PHOTO'}
            </button>
          </div>
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
            {photoMessage && (
              <p style={{ fontSize: '0.7rem', marginTop: '0.5rem', color: photoMessage.includes('updated') ? '#4f7c5d' : 'var(--accent-dark)' }}>
                {photoMessage}
              </p>
            )}
            <p style={{ fontSize: '0.65rem', marginTop: '0.35rem', color: 'var(--text-secondary)' }}>
              Tip: copy a photo, then press <strong>Ctrl+V</strong> anywhere on this page to paste it.
            </p>
            <p style={{ fontSize: '0.65rem', marginTop: '0.35rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Tap change photo to pick from your gallery or take a new one. This is the picture voters see.
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
            Share this link on WhatsApp or social media — it shows your photo in the preview, then opens voting.
          </p>
        </div>
        
        <div className="dashboard-share-input-group">
          <input
            type="text"
            readOnly
            value={getNomineeShareUrl(nominee.code, API_BASE_URL)}
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

      {/* Main Grid: Shows recent voters logs spanning full width */}
      <div className="dashboard-main-grid" style={{ gridTemplateColumns: '1fr' }}>

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
