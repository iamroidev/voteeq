import React, { useState, useEffect } from 'react';
import VoteModal from './components/VoteModal';
import MockPaystack from './components/MockPaystack';
import NomineeDashboard from './components/NomineeDashboard';

export default function App() {
  // Navigation & Page State
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals & Action States
  const [activeVoteNominee, setActiveVoteNominee] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  
  // Nominee Login/Dashboard
  const [authNominee, setAuthNominee] = useState(() => {
    const saved = localStorage.getItem('voteeq_auth');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginMode, setLoginMode] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginError, setLoginError] = useState('');

  // Accent Color Theme state (Sophisticated antique gold default)
  const [accent, setAccent] = useState('#b8986c');

  // USSD Simulator State (Device Widget)
  const [ussdOpen, setUssdOpen] = useState(false);
  const [ussdPhone, setUssdPhone] = useState('0244112233');
  const [ussdSessionId, setUssdSessionId] = useState('');
  const [ussdScreen, setUssdScreen] = useState('');
  const [ussdInput, setUssdInput] = useState('');
  const [ussdLoading, setUssdLoading] = useState(false);
  const [ussdAction, setUssdAction] = useState('release'); // 'prompt' or 'release'

  const loadData = async () => {
    try {
      const catRes = await fetch('http://localhost:5000/api/categories');
      const nomRes = await fetch('http://localhost:5000/api/nominees');
      if (catRes.ok && nomRes.ok) {
        const catData = await catRes.json();
        const nomData = await nomRes.json();
        setCategories(catData);
        setNominees(nomData);

        // Check for shareable direct nominee link parameter (e.g. ?nominee=101)
        const params = new URLSearchParams(window.location.search);
        const nomineeCode = params.get('nominee');
        if (nomineeCode) {
          const match = nomData.find(n => n.code === nomineeCode);
          if (match) {
            setActiveVoteNominee(match);
            // Clean URL query parameters quietly after capturing, keeping URL clean
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }
      }
    } catch (err) {
      console.error('API load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll nominees votes tallies every 7 seconds
    const interval = setInterval(loadData, 7000);
    return () => clearInterval(interval);
  }, []);

  const changeAccent = (color) => {
    setAccent(color);
    document.documentElement.style.setProperty('--accent', color);
    
    let darkColor = '#8e714b';
    if (color === '#6a2e2e') darkColor = '#4a1d1d';
    if (color === '#2a2b2d') darkColor = '#151515';
    if (color === '#606f5c') darkColor = '#414f3e';
    document.documentElement.style.setProperty('--accent-dark', darkColor);
  };

  // Toast notifier helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Copy share link helper
  const copyShareLink = (nomineeCode, nomineeName) => {
    const link = `${window.location.origin}/?nominee=${nomineeCode}`;
    navigator.clipboard.writeText(link).then(() => {
      triggerToast(`Share link copied for ${nomineeName.toUpperCase()}`);
    }).catch(err => {
      console.error('Copy failed', err);
    });
  };

  // Payment checkout triggers
  const handlePaymentRedirect = (data) => {
    setActiveVoteNominee(null);
    if (data.isMock) {
      setCheckoutData(data);
    } else {
      window.location.href = data.authorization_url;
    }
  };

  const handlePaymentSuccess = (success, details) => {
    setCheckoutData(null);
    triggerToast('Thank you! Your votes have been registered.');
    loadData();

    if (details && details.voteAgain && details.nomineeId) {
      const match = nominees.find(n => n.id === details.nomineeId);
      if (match) {
        setTimeout(() => {
          setActiveVoteNominee(match);
        }, 350);
      }
    }
  };

  // Nominee Login Flow
  const handleNomineeLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    try {
      const response = await fetch('http://localhost:5000/api/nominees/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: loginCode, passcode: loginPasscode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication error');
      }

      setAuthNominee(data);
      localStorage.setItem('voteeq_auth', JSON.stringify(data));
      setLoginMode(false);
      setLoginCode('');
      setLoginPasscode('');
      triggerToast('Nominee dashboard unlocked');
    } catch (err) {
      setLoginError(err.message || 'Verification failed');
    }
  };

  const handleLogout = () => {
    setAuthNominee(null);
    localStorage.removeItem('voteeq_auth');
    triggerToast('Logged out successfully');
  };

  // USSD Sandbox Logic
  const initUssdSession = async (customDial = '') => {
    setUssdLoading(true);
    const sId = `ussd_sim_${Date.now()}`;
    setUssdSessionId(sId);
    
    const dialString = customDial || '*920*102#';

    try {
      const response = await fetch('http://localhost:5000/api/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: sId,
          msisdn: ussdPhone,
          newSession: 1,
          userData: dialString
        }),
      });

      const data = await response.json();
      setUssdScreen(data.message);
      setUssdAction(data.action);
    } catch (err) {
      setUssdScreen('Connection error during USSD dial.');
      setUssdAction('release');
    } finally {
      setUssdLoading(false);
    }
  };

  const submitUssdInput = async (e) => {
    e.preventDefault();
    if (!ussdInput.trim() || ussdLoading) return;
    setUssdLoading(true);

    try {
      const response = await fetch('http://localhost:5000/api/ussd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionID: ussdSessionId,
          msisdn: ussdPhone,
          newSession: 0,
          userData: ussdInput
        }),
      });

      const data = await response.json();
      setUssdScreen(data.message);
      setUssdAction(data.action);
      setUssdInput('');
      
      if (data.action === 'release') {
        setTimeout(loadData, 3500);
      }
    } catch (err) {
      setUssdScreen('USSD communication interrupted.');
      setUssdAction('release');
    } finally {
      setUssdLoading(false);
    }
  };

  const dialUssdCode = (code) => {
    setUssdOpen(true);
    initUssdSession(code);
    triggerToast(`Dialing shortcode: ${code}`);
  };

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') {
      return nominees.length;
    }
    return nominees.filter(n => n.category_id === parseInt(categoryId) || n.category_id === categoryId).length;
  };

  const filteredNominees = nominees.filter(nom => {
    const matchesCategory = selectedCategory === 'all' || nom.category_id === parseInt(selectedCategory);
    const matchesSearch = nom.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          nom.code.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="app-container">
      {/* Toast Alert System */}
      <div className={`luxury-toast ${toastMessage ? 'visible' : ''}`}>
        {toastMessage}
      </div>

      {/* Main Luxury Navigation Bar */}
      <nav className="luxury-nav">
        <a href="/" onClick={(e) => { e.preventDefault(); handleLogout(); }} className="luxury-logo">
          VOTEEQ
        </a>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Custom Luxury Colorway Selector */}
          <div className="theme-picker-container">
            {[
              { name: 'Gold', value: '#b8986c' },
              { name: 'Burgundy', value: '#6a2e2e' },
              { name: 'Midnight', value: '#2a2b2d' },
              { name: 'Sage', value: '#606f5c' }
            ].map(theme => (
              <button
                key={theme.value}
                onClick={() => changeAccent(theme.value)}
                className={`theme-picker-btn ${accent === theme.value ? 'active' : ''}`}
                style={{ backgroundColor: theme.value }}
                title={`${theme.name} Theme`}
              />
            ))}
          </div>

          <button 
            onClick={() => setUssdOpen(!ussdOpen)} 
            className="luxury-btn secondary"
            style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', letterSpacing: '0.1em' }}
          >
            SHORTCODE DIALER
          </button>

          {authNominee ? (
            <button 
              onClick={handleLogout}
              className="luxury-btn secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', letterSpacing: '0.1em' }}
            >
              LOGOUT ({authNominee.nominee.code})
            </button>
          ) : (
            <button 
              onClick={() => setLoginMode(true)}
              className="luxury-btn"
              style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', letterSpacing: '0.1em' }}
            >
              NOMINEE LOGIN
            </button>
          )}
        </div>
      </nav>

      {/* SECURE DASHBOARD ROUTE */}
      {authNominee ? (
        <NomineeDashboard 
          code={authNominee.nominee.code} 
          token={authNominee.token} 
          onLogout={handleLogout} 
          copyShareLink={copyShareLink}
          dialUssdCode={dialUssdCode}
        />
      ) : (
        /* PUBLIC VOTING LANDING PAGE */
        <div>
          {/* Hero Marquee Section */}
          <div className="editorial-header-section">
            <span className="editorial-tagline">OFFICIAL VOTING PORTAL</span>
            <h1 className="editorial-title">VOTEEQ AWARDS</h1>
            <div className="editorial-divider" />
          </div>

          {/* Clean Categorization Filter Tabs */}
          <div className="filter-panel">
            <div className="category-tabs">
              <button 
                className={`category-tab-btn ${selectedCategory === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedCategory('all')}
              >
                All Nominees ({getCategoryCount('all')})
              </button>
              {categories.map(c => (
                <button 
                  key={c.id}
                  className={`category-tab-btn ${selectedCategory === String(c.id) || selectedCategory === c.id ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(c.id)}
                >
                  {c.name} ({getCategoryCount(c.id)})
                </button>
              ))}
            </div>

            <div style={{ minWidth: '280px' }}>
              <div className="editorial-search-container">
                <svg 
                  className="editorial-search-icon" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="SEARCH NOMINEE NAME OR CODE..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ 
                    border: 'none',
                    background: 'transparent', 
                    padding: '0.4rem 0',
                    fontSize: '0.75rem',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    width: '100%',
                    outline: 'none',
                    color: 'var(--text-primary)'
                  }}
                />
                {searchQuery && (
                  <button 
                    className="clear-search-btn" 
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Loading Indicator */}
          {loading && nominees.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '6rem 0' }}>
              <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
                Catalog Loading...
              </h2>
            </div>
          ) : (
            /* Nominees Editorial Column Grid */
            <div className="editorial-grid">
              {filteredNominees.length === 0 ? (
                <div className="editorial-sheet" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                    No results found
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Try adjusting your criteria or category tabs.
                  </p>
                </div>
              ) : (
                filteredNominees.map(nom => (
                  <div key={nom.id} className="editorial-card">
                    {/* Visual Portrait */}
                    <div className="editorial-image-wrapper">
                      <img src={nom.photo_url} alt={nom.name} />
                      <div style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '1rem',
                        zIndex: 10
                      }}>
                        <span className="ref-badge" style={{ background: 'var(--bg-secondary)' }}>
                          REF. {nom.code}
                        </span>
                      </div>
                    </div>

                    {/* Meta category details */}
                    <div className="editorial-card-meta">
                      {nom.category_name}
                    </div>

                    {/* Portrait Title */}
                    <h3 className="editorial-card-title">{nom.name}</h3>
                    
                    {/* Vote count tally */}
                    <div className="editorial-card-votes">
                      <span className="votes-number">{nom.votes_count}</span>
                      <span className="votes-label">votes verified</span>
                    </div>

                    {/* Actions container */}
                    <div className="editorial-card-actions">
                      <button 
                        onClick={() => setActiveVoteNominee(nom)}
                        className="luxury-btn"
                        style={{ width: '100%' }}
                      >
                        VOTE ONLINE
                      </button>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                        <button 
                          onClick={() => dialUssdCode(`*920*102*${nom.code}#`)}
                          style={{
                            background: 'none',
                            border: 'none',
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: 'var(--accent-dark)',
                            cursor: 'pointer',
                            padding: 0,
                            letterSpacing: '0.05em',
                            textDecoration: 'underline',
                            transition: 'var(--transition-fast)'
                          }}
                          title="Dial USSD code automatically"
                          onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
                          onMouseLeave={(e) => e.target.style.color = 'var(--accent-dark)'}
                        >
                          DIAL *920*102*{nom.code}#
                        </button>
                        
                        <button 
                          onClick={() => copyShareLink(nom.code, nom.name)} 
                          className="luxury-btn text-link"
                        >
                          [ Copy link ]
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Editorial Luxury Footer */}
      <footer style={{
        marginTop: '8rem',
        paddingTop: '4rem',
        paddingBottom: '4rem',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        gap: '3rem',
        fontSize: '0.85rem'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '2.5rem'
        }}>
          <div style={{ flex: '1', minWidth: '280px', maxWidth: '400px' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>
              VOTEEQ AWARDS
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.75rem' }}>
              A premium recognition platform dedicated to honoring excellence and creative achievements in the contemporary musical arts. Powered by secure mobile money channels.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
            <div>
              <h4 style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Quick Links
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>About the Awards</a></li>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>Help & Support</a></li>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>Nominee Guidelines</a></li>
              </ul>
            </div>
            
            <div>
              <h4 style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                Legal & Security
              </h4>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>Terms & Conditions</a></li>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>Privacy Policy</a></li>
                <li><a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => e.preventDefault()}>Payment Protection</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem',
          borderTop: '1px solid var(--border-color)',
          paddingTop: '2rem',
          fontSize: '0.7rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase'
        }}>
          <span>&copy; {new Date().getFullYear()} VOTEEQ. All rights reserved.</span>
        </div>
      </footer>

      {/* ---------------------------------------------------- */}
      {/* MODALS REGISTRY */}
      {/* ---------------------------------------------------- */}

      {/* Nominee Login Modal */}
      {loginMode && (
        <div className="luxury-modal-overlay">
          <div className="luxury-modal" style={{ maxWidth: '420px' }}>
            <div className="luxury-modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Nominee Access</h2>
              <button 
                onClick={() => { setLoginMode(false); setLoginError(''); }} 
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>
            <div className="luxury-modal-body">
              {loginError && (
                <div style={{ 
                  background: 'var(--accent-light)', 
                  borderLeft: '3px solid var(--accent)', 
                  padding: '0.75rem 1rem', 
                  fontSize: '0.8rem', 
                  color: 'var(--accent-dark)',
                  marginBottom: '1.5rem',
                  fontWeight: 500
                }}>
                  {loginError}
                </div>
              )}
              <form onSubmit={handleNomineeLogin}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Nominee Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value)}
                    className="luxury-input"
                  />
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Passcode PIN
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    placeholder="••••"
                    value={loginPasscode}
                    onChange={(e) => setLoginPasscode(e.target.value)}
                    className="luxury-input"
                  />
                </div>
                <button type="submit" className="luxury-btn" style={{ width: '100%' }}>
                  Unlock Dashboard
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Web Vote Modal Checkout */}
      {activeVoteNominee && (
        <VoteModal 
          nominee={activeVoteNominee} 
          onClose={() => setActiveVoteNominee(null)} 
          onPaymentRedirect={handlePaymentRedirect}
        />
      )}

      {/* Paystack Payment Checkout Sandbox Screen */}
      {checkoutData && (
        <MockPaystack 
          checkoutData={checkoutData} 
          onComplete={handlePaymentSuccess} 
          onCancel={() => setCheckoutData(null)}
        />
      )}

      {/* FLOATING SHORTCODE DIALER WIDGET */}
      {ussdOpen && (
        <div className="ussd-device-frame">
          <div className="ussd-device-header">
            <span>SHORTCODE DIALER</span>
            <button 
              onClick={() => setUssdOpen(false)} 
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}
            >
              ✕
            </button>
          </div>
          
          <div style={{ padding: '0.75rem' }}>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', color: '#888', marginBottom: '0.25rem', fontWeight: 700 }}>
                Phone Number
              </label>
              <input 
                type="text" 
                value={ussdPhone} 
                onChange={(e) => setUssdPhone(e.target.value)}
                style={{ 
                  width: '100%', 
                  background: '#1c1c1c', 
                  color: '#fff', 
                  border: '1px solid #333', 
                  padding: '0.4rem', 
                  fontFamily: 'monospace',
                  outline: 'none',
                  fontSize: '0.75rem'
                }} 
              />
            </div>

            {/* Simulated LCD Screen */}
            <div className="ussd-device-screen">
              {ussdLoading ? (
                <div style={{ textAlign: 'center', marginTop: '2.5rem', color: '#666' }}>
                  Connecting...
                </div>
              ) : ussdScreen ? (
                <div>{ussdScreen}</div>
              ) : (
                <div style={{ color: '#666', textAlign: 'center', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  ENTER SHORTCODE:<br/><br/>
                  • *920*102# (Main Menu)<br/>
                  • *920*102*101# (Vote for Stonebwoy)<br/>
                  • *920*102*201# (Vote for Black Sherif)
                </div>
              )}
            </div>

            {/* Dial Console input */}
            {ussdScreen && ussdAction === 'prompt' ? (
              <form onSubmit={submitUssdInput} style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Option..."
                  value={ussdInput}
                  onChange={(e) => setUssdInput(e.target.value)}
                  className="ussd-device-input"
                  autoFocus
                />
                <button 
                  type="submit" 
                  style={{
                    background: 'var(--accent)',
                    color: '#000',
                    fontWeight: 700,
                    border: 'none',
                    padding: '0 0.75rem',
                    cursor: 'pointer',
                    fontSize: '0.7rem',
                    textTransform: 'uppercase'
                  }}
                >
                  SEND
                </button>
              </form>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                <button
                  onClick={() => initUssdSession('*920*102#')}
                  style={{
                    background: '#222',
                    color: '#fff',
                    border: 'none',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    textTransform: 'uppercase'
                  }}
                >
                  DIAL MENU
                </button>
                <button
                  onClick={() => initUssdSession('*920*102*101#')}
                  style={{
                    background: '#222',
                    color: '#fff',
                    border: 'none',
                    padding: '0.4rem',
                    cursor: 'pointer',
                    fontSize: '0.65rem',
                    fontWeight: 500,
                    textTransform: 'uppercase'
                  }}
                >
                  DIAL *101#
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
