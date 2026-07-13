import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import VoteModal from './components/VoteModal';
import MockPaystack from './components/MockPaystack';

const NomineeDashboard = lazy(() => import('./components/NomineeDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
import AboutPage from './pages/AboutPage';
import HelpSupportPage from './pages/HelpSupportPage';
import GuidelinesPage from './pages/GuidelinesPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import PaymentPage from './pages/PaymentPage';
import EventsTicketsPage from './pages/EventsTicketsPage';
import AwaitingNomineesPanel from './components/AwaitingNomineesPanel';
import CategoryBrowser from './components/CategoryBrowser';
import LeaderboardPanel from './components/LeaderboardPanel';
import PublicVoteFilters from './components/PublicVoteFilters';
import PaymentStatusPage from './pages/PaymentStatusPage';
import NotFoundPage from './pages/NotFoundPage';
import { API_BASE_URL, WS_BASE_URL } from './config';
import { BRANDING, formatEventDate, formatEventMeta, getNomineeShareUrl, displayEventTitle, getNomineeUssdCode } from './branding';
import { readStoredAuth } from './utils/storage';
import { nomineePhotoSrc } from './utils/photoUrl';
import { COLOR_THEMES, applyAccentTheme, getStoredAccent } from './utils/theme';

const VOTE_GRID_PAGE_SIZE = 12;

const MOBILE_MENU_PAGES = [
  { id: 'about', label: 'About' },
  { id: 'help', label: 'Help & Support' },
  { id: 'guidelines', label: 'Nominee Guidelines' },
];

export default function App() {
  // Navigation & Page State
  const [categories, setCategories] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [voteGridVisibleCount, setVoteGridVisibleCount] = useState(VOTE_GRID_PAGE_SIZE);
  const voteResultsRef = useRef(null);
  const leaderboardResultsRef = useRef(null);

  // Modals & Action States
  const [activeVoteNominee, setActiveVoteNominee] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Nominee Login/Dashboard
  const [authNominee, setAuthNominee] = useState(() => readStoredAuth('voteeq_auth'));
  const [loginMode, setLoginMode] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  const [loginPasscode, setLoginPasscode] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Admin Login/Dashboard States
  const [authAdmin, setAuthAdmin] = useState(() => readStoredAuth('voteeq_admin_auth'));
  const [adminLoginMode, setAdminLoginMode] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoginError, setAdminLoginError] = useState('');

  // Nominee Register/PIN Activation States
  const [registerMode, setRegisterMode] = useState(false);
  const [registerCode, setRegisterCode] = useState('');
  const [registerActivationCode, setRegisterActivationCode] = useState('');
  const [registerPin, setRegisterPin] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');

  // Mobile Menu Drawer State
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Active public view tab ('vote' or 'leaderboard')
  const [activeTab, setActiveTab] = useState(BRANDING.defaultTab);
  const [events, setEvents] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [activeEventId, setActiveEventId] = useState(undefined);

  // Footer page navigation state
  const [currentPage, setCurrentPage] = useState(null);
  const [previousTab, setPreviousTab] = useState('vote');

  // Accent Color Theme state (Sophisticated antique gold default)
  const [accent, setAccent] = useState(() => getStoredAccent());
  const activeTheme = COLOR_THEMES.find((t) => t.value === accent) || COLOR_THEMES[0];

  // WebSocket updates state trigger
  const [wsTrigger, setWsTrigger] = useState(0);

  const parseHashRoute = () => {
    const rawHash = window.location.hash || `#/${BRANDING.defaultTab}`;
    if (!rawHash.startsWith('#/')) {
      return { path: 'vote', params: new URLSearchParams() };
    }

    const [path, query = ''] = rawHash.substring(2).split('?');
    return { path, params: new URLSearchParams(query) };
  };

  const buildPublicHash = (path, params = {}) => {
    const search = new URLSearchParams(params);
    return `#/${path}${search.toString() ? `?${search.toString()}` : ''}`;
  };

  const navigateToTab = (tab) => {
    window.location.hash = buildPublicHash(tab, activeEventId ? { eventId: activeEventId } : {});
  };

  const handleEventChange = (nextEventId) => {
    const nextEvent = events.find((event) => String(event.id) === String(nextEventId));
    setActiveEventId(nextEventId);
    setActiveEvent(nextEvent || null);
    window.location.hash = buildPublicHash(activeTab, nextEventId ? { eventId: nextEventId } : {});
  };

  const scrollToVoteResults = () => {
    requestAnimationFrame(() => {
      voteResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const scrollToLeaderboardResults = () => {
    requestAnimationFrame(() => {
      leaderboardResultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId === 'all' ? 'all' : String(categoryId));
    if (activeTab === 'vote') scrollToVoteResults();
    if (activeTab === 'leaderboard') scrollToLeaderboardResults();
  };

  const navigateToPage = (page) => {
    window.location.hash = buildPublicHash(page);
  };

  const handleBackToPortal = () => {
    window.location.hash = buildPublicHash(previousTab, activeEventId ? { eventId: activeEventId } : {});
  };

  // USSD Simulator State (Device Widget)
  const [ussdOpen, setUssdOpen] = useState(false);
  const [ussdPhone, setUssdPhone] = useState('0244112233');
  const [ussdSessionId, setUssdSessionId] = useState('');
  const [ussdScreen, setUssdScreen] = useState('');
  const [ussdInput, setUssdInput] = useState('');
  const [ussdLoading, setUssdLoading] = useState(false);
  const [ussdAction, setUssdAction] = useState('release'); // 'prompt' or 'release'

  const loadData = async () => {
    setLoadError('');
    try {
      const [catRes, nomRes, eventRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/categories`),
        fetch(`${API_BASE_URL}/api/nominees`),
        fetch(`${API_BASE_URL}/api/events`),
      ]);
      if (!catRes.ok || !nomRes.ok || !eventRes.ok) {
        throw new Error('Could not load catalog data from the API. Check your connection or try again later.');
      }
      const [catData, nomData, eventData] = await Promise.all([
        catRes.json(),
        nomRes.json(),
        eventRes.json(),
      ]);
      {
        setCategories(catData);
        setNominees(nomData);
        if (eventData && eventData.length > 0) {
          const hashRoute = parseHashRoute();
          const urlParams = new URLSearchParams(window.location.search);
          const requestedEventId = hashRoute.params.get('eventId') || urlParams.get('eventId');
          const requestedEvent = requestedEventId ? eventData.find(e => String(e.id) === String(requestedEventId)) : null;
          const nextEvent = requestedEvent || (activeEventId === undefined ? eventData[0] : eventData.find(e => String(e.id) === String(activeEventId)) || null);
          if (nextEvent) {
            setActiveEventId(String(nextEvent.id));
            setActiveEvent(nextEvent);
          } else {
            setActiveEventId(null);
            setActiveEvent(null);
          }
          setEvents(eventData);
        } else {
          setEvents([]);
          setActiveEvent(null);
          setActiveEventId(null);
        }

        // Check for shareable direct nominee link parameter (e.g. ?nominee=101)
        const hashRoute = parseHashRoute();
        const urlParams = new URLSearchParams(window.location.search);
        const nomineeCode = hashRoute.params.get('nominee') || urlParams.get('nominee');
        const eventId = hashRoute.params.get('eventId') || urlParams.get('eventId');
        if (nomineeCode) {
          const match = nomData.find(n => n.code === nomineeCode);
          if (match) {
            setActiveVoteNominee(match);
            setActiveTab('vote');
            setCurrentPage(null);
            window.location.hash = buildPublicHash('vote', eventId ? { eventId } : {});
            // Clean URL query parameters quietly after capturing, keeping URL clean
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
          }
        }
      }
    } catch (err) {
      console.error('API load error:', err);
      setLoadError(err.message || 'Failed to load data from the server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = BRANDING.documentTitle;
    applyAccentTheme(getStoredAccent());
  }, []);

  const changeAccent = (color) => {
    setAccent(color);
    applyAccentTheme(color);
  };

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setLoginMode(false);
        setRegisterMode(false);
        setAdminLoginMode(false);
        setActiveVoteNominee(null);
        setCheckoutData(null);
        setUssdOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadData();

      // Intercept direct navigation to /admin or /admin/
      const cleanPath = window.location.pathname.replace(/\/$/, '');
      if (cleanPath === '/admin') {
        if (!authAdmin) {
          setAdminLoginMode(true);
        }
        window.history.replaceState({}, document.title, '/');
      } else if (cleanPath === '/payment-status') {
        const query = window.location.search;
        window.location.hash = `#/payment-status${query}`;
        window.history.replaceState({}, document.title, '/');
      }
    }, 0);

    const pollIfVisible = () => {
      if (!document.hidden && !authAdmin && !authNominee) {
        loadData();
      }
    };
    const interval = setInterval(pollIfVisible, 30000);
    const onVisibility = () => {
      if (!document.hidden) pollIfVisible();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [authAdmin, authNominee]);

  // Sync state with URL Hash for proper routing/navigation
  useEffect(() => {
    const handleHashChange = () => {
      if (authAdmin) {
        setCurrentPage(null);
        syncDashboardHash('admin');
        return;
      }
      if (authNominee?.nominee?.code && authNominee?.token) {
        setCurrentPage(null);
        syncDashboardHash('nominee');
        return;
      }

      const { path, params } = parseHashRoute();
      const eventId = params.get('eventId');
      if (eventId) {
        setActiveEventId(eventId);
      }

      const footerPages = ['about', 'help', 'guidelines', 'terms', 'privacy', 'payment'];
      if (path) {
        if (path === 'apply') {
          setCurrentPage('not-found');
        } else if (footerPages.includes(path)) {
          setPreviousTab(activeTab || previousTab);
          setCurrentPage(path);
        } else if (path === 'tickets' || path === 'leaderboard' || path === 'vote') {
          setCurrentPage(null);
          setActiveTab(path);
          setPreviousTab(path);
        } else if (path === 'payment-status') {
          setCurrentPage('payment-status');
        } else if (path === 'admin') {
          setCurrentPage(null);
          if (!authAdmin) {
            setAdminLoginMode(true);
            window.location.hash = buildPublicHash(BRANDING.defaultTab);
          }
        } else if (path === 'nominee' || path === 'nomine') {
          setCurrentPage(null);
          if (!authNominee) {
            setLoginMode(true);
            window.location.hash = buildPublicHash(BRANDING.defaultTab);
          } else {
            syncDashboardHash('nominee');
          }
        } else {
          setCurrentPage('not-found');
        }
      } else if (!window.location.hash || window.location.hash === '#') {
        setCurrentPage(null);
        setActiveTab(BRANDING.defaultTab);
        setPreviousTab(BRANDING.defaultTab);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [authAdmin, authNominee]);

  useEffect(() => {
    let socket = null;
    let reconnectTimeout = null;
    let delay = 1000;
    const maxDelay = 16000;

    function connect() {
      console.log('Attempting WebSocket connection...');
      socket = new WebSocket(WS_BASE_URL);

      socket.onopen = () => {
        console.log('Real-time sync connection established');
        delay = 1000;
      };

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'VOTE_COMPLETED') {
            setNominees(prev => prev.map(nom => {
              if (nom.id === message.nomineeId) {
                return { ...nom, votes_count: nom.votes_count + message.votesCount };
              }
              return nom;
            }));
            setWsTrigger(prev => prev + 1);
          }
        } catch (err) {
          console.error('WS message parsing failed:', err);
        }
      };

      socket.onclose = (e) => {
        console.log(`Real-time sync connection closed (code: ${e.code}). Attempting reconnect...`);
        cleanup();
        reconnectTimeout = setTimeout(() => {
          delay = Math.min(delay * 2, maxDelay);
          connect();
        }, delay);
      };

      socket.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        socket.close();
      };
    }

    function cleanup() {
      if (socket) {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onclose = null;
        socket.onerror = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    }

    const connectDelay = setTimeout(connect, 2500);

    return () => {
      clearTimeout(connectDelay);
      cleanup();
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Toast notifier helper
  const triggerToast = (msg) => {
    setToastMessage(msg);
  };

  const dismissToast = () => {
    setToastMessage('');
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(''), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    setVoteGridVisibleCount(VOTE_GRID_PAGE_SIZE);
  }, [selectedCategory, searchQuery, activeEventId]);

  const syncDashboardHash = (path) => {
    const target = `#/${path}`;
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target);
    }
  };

  // Copy share link helper
  const copyShareLink = (nomineeCode, nomineeName) => {
    const link = getNomineeShareUrl(nomineeCode, API_BASE_URL);
    navigator.clipboard.writeText(link).then(() => {
      triggerToast(`Share link copied for ${nomineeName.toUpperCase()} — preview shows their photo`);
    }).catch(err => {
      console.error('Copy failed', err);
      triggerToast('Could not copy link to clipboard');
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
    if (details?.isTicket) {
      const ticketQty = details.quantity || (details.ticket ? details.ticket.quantity : 1);
      const title = details.eventTitle || (details.ticket ? details.ticket.event_title : 'Event');
      triggerToast(`Thank you! Reserved ${ticketQty} ticket(s) for ${title}.`);
      
      if (details.ticket) {
        try {
          const saved = localStorage.getItem('voteeq_purchased_tickets');
          const ticketsList = saved ? JSON.parse(saved) : [];
          // Avoid duplicate entries if processed twice
          if (!ticketsList.some(t => t.id === details.ticket.id || t.ticket_code === details.ticket.ticket_code)) {
            ticketsList.push(details.ticket);
            localStorage.setItem('voteeq_purchased_tickets', JSON.stringify(ticketsList));
            // Trigger local update events
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('ticket-purchased'));
          }
        } catch (e) {
          console.error('Failed to save ticket locally:', e);
        }
      }
    } else if (details?.isForm) {
      triggerToast('Application fee paid successfully. Submitted for review.');
    } else {
      triggerToast('Thank you! Your votes have been registered.');
    }
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
    setLoginSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/nominees/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: loginCode.trim(), passcode: loginPasscode }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication error');
      }
      if (!data?.token || !data?.nominee?.code) {
        throw new Error('Invalid login response from server');
      }

      setAuthNominee(data);
      localStorage.setItem('voteeq_auth', JSON.stringify(data));
      setLoginMode(false);
      setLoginCode('');
      setLoginPasscode('');
      syncDashboardHash('nominee');
      triggerToast('Nominee dashboard ready');
    } catch (err) {
      setLoginError(err.message || 'Verification failed');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = () => {
    setAuthNominee(null);
    localStorage.removeItem('voteeq_auth');
    triggerToast('Logged out successfully');
    window.location.hash = buildPublicHash('vote');
  };

  // Admin Login Flow
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAdminLoginError('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Admin login failed');
      }

      setAuthAdmin(data);
      localStorage.setItem('voteeq_admin_auth', JSON.stringify(data));
      setAdminLoginMode(false);
      setAdminUsername('');
      setAdminPassword('');
      triggerToast('Welcome to Admin Console');
    } catch (err) {
      setAdminLoginError(err.message || 'Verification failed');
    }
  };

  const handleAdminLogout = () => {
    setAuthAdmin(null);
    localStorage.removeItem('voteeq_admin_auth');
    triggerToast('Logged out from Admin Console');
    window.location.hash = buildPublicHash('vote');
  };

  // Nominee PIN Registration Flow
  const handleNomineeRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');
    setRegisterSuccess('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/nominees/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: registerCode,
          activationCode: registerActivationCode,
          newPin: registerPin
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'PIN Activation failed');
      }

      setRegisterSuccess('Activation successful! You can now log in.');
      setRegisterPin('');
      setRegisterActivationCode('');
      triggerToast('Nominee PIN Activated!');
      loadData(); // refresh nominees list

      // Auto redirect to login mode after 2 seconds
      setTimeout(() => {
        setRegisterMode(false);
        setRegisterSuccess('');
        setLoginMode(true);
        setLoginCode(registerCode);
        setRegisterCode('');
      }, 2000);
    } catch (err) {
      setRegisterError(err.message || 'Registration failed');
    }
  };

  // USSD Sandbox Logic
  const initUssdSession = async (customDial = '') => {
    setUssdLoading(true);
    const sId = `ussd_sim_${Date.now()}`;
    setUssdSessionId(sId);

    const dialString = customDial || BRANDING.ussdShortcode;

    try {
      const response = await fetch(`${API_BASE_URL}/api/ussd`, {
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
    } catch {
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
      const response = await fetch(`${API_BASE_URL}/api/ussd`, {
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
    } catch {
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

  const eventScopedNominees = activeEventId
    ? nominees.filter(nom => !nom.event_id || String(nom.event_id) === String(activeEventId))
    : nominees;

  const hasPublishedNominees = eventScopedNominees.length > 0;
  const categoriesWithNominees = categories.filter((c) =>
    eventScopedNominees.some((n) => String(n.category_id) === String(c.id))
  );
  const selectedCategoryName =
    selectedCategory === 'all'
      ? null
      : categories.find((c) => String(c.id) === String(selectedCategory))?.name;

  const getCategoryCount = (categoryId) => {
    if (categoryId === 'all') {
      return eventScopedNominees.length;
    }
    return eventScopedNominees.filter(n => n.category_id === parseInt(categoryId) || n.category_id === categoryId).length;
  };

  const filteredNominees = eventScopedNominees.filter(nom => {
    const matchesCategory = selectedCategory === 'all' || String(nom.category_id) === String(selectedCategory);
    const matchesSearch = nom.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nom.code.includes(searchQuery);
    return matchesCategory && matchesSearch;
  });

  const visibleVoteNominees = filteredNominees.slice(0, voteGridVisibleCount);
  const hasMoreVoteNominees = filteredNominees.length > voteGridVisibleCount;

  const isOverlayOpen = Boolean(
    activeVoteNominee ||
    checkoutData ||
    loginMode ||
    registerMode ||
    adminLoginMode ||
    mobileMenuOpen
  );

  return (
    <div className={`app-container${authAdmin ? ' admin-mode' : ''}`} style={{ position: 'relative' }}>
      {/* Dynamic Ambient Blur Glows */}
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      {/* Toast Alert System */}
      {toastMessage && (
        <div
          className="luxury-toast visible"
          role="status"
          aria-live="polite"
          onClick={dismissToast}
          onKeyDown={(e) => { if (e.key === 'Escape') dismissToast(); }}
          tabIndex={0}
          title="Dismiss"
        >
          {toastMessage}
        </div>
      )}

      {/* Main Luxury Navigation Bar — hidden while modals/drawers are open */}
      {!isOverlayOpen && (
      <nav className="luxury-nav">
        <a href={`#/${BRANDING.defaultTab}`} onClick={(e) => { e.preventDefault(); navigateToTab(BRANDING.defaultTab); }} className="luxury-logo">
          {BRANDING.platformName.toUpperCase()}
        </a>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="mobile-menu-toggle"
          type="button"
          aria-label="Open navigation menu"
        >
          MENU
        </button>

        <div className="luxury-nav-actions">
          {/* Main Public View Selector */}
          {!authAdmin && !authNominee && (
            <div role="tablist" style={{ display: 'flex', gap: '0.4rem', marginRight: '1.25rem', borderRight: '1px solid var(--border-color)', paddingRight: '1.25rem' }}>
              <button
                role="tab"
                aria-selected={activeTab === 'vote' && !currentPage}
                onClick={() => { navigateToTab('vote'); }}
                className={`luxury-btn text-link ${activeTab === 'vote' && !currentPage ? 'active' : ''}`}
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  padding: '0.4rem 0.5rem',
                  borderBottom: activeTab === 'vote' && !currentPage ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 0,
                  fontWeight: 600
                }}
              >
                VOTE PORTAL
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'leaderboard' && !currentPage}
                onClick={() => { navigateToTab('leaderboard'); }}
                className={`luxury-btn text-link ${activeTab === 'leaderboard' && !currentPage ? 'active' : ''}`}
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  padding: '0.4rem 0.5rem',
                  borderBottom: activeTab === 'leaderboard' && !currentPage ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 0,
                  fontWeight: 600
                }}
              >
                LEADERBOARD
              </button>
              <button
                role="tab"
                aria-selected={activeTab === 'tickets' && !currentPage}
                onClick={() => { navigateToTab('tickets'); }}
                className={`luxury-btn text-link ${activeTab === 'tickets' && !currentPage ? 'active' : ''}`}
                style={{
                  fontSize: '0.65rem',
                  letterSpacing: '0.1em',
                  padding: '0.4rem 0.5rem',
                  borderBottom: activeTab === 'tickets' && !currentPage ? '1px solid var(--accent)' : '1px solid transparent',
                  borderRadius: 0,
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}
              >
                TICKETS
                {!BRANDING.ticketsEnabled && (
                  <span className="nav-status-pill">Not open</span>
                )}
              </button>
            </div>
          )}
          {/* Custom Luxury Colorway Selector */}
          <div className="theme-picker-container" title={`Theme: ${activeTheme.name}`}>
            <span className="theme-picker-label">{activeTheme.name}</span>
            <div className="theme-picker-swatches">
              {COLOR_THEMES.map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => changeAccent(theme.value)}
                  className={`theme-picker-btn ${accent === theme.value ? 'active' : ''}`}
                  style={{ backgroundColor: theme.value }}
                  title={theme.name}
                  aria-label={`${theme.name} theme${accent === theme.value ? ' (active)' : ''}`}
                  aria-pressed={accent === theme.value}
                  type="button"
                />
              ))}
            </div>
          </div>

          {import.meta.env.DEV && BRANDING.showUssd && (
            <button
              onClick={() => setUssdOpen(!ussdOpen)}
              className="luxury-btn secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', letterSpacing: '0.1em' }}
            >
              SHORTCODE DIALER
            </button>
          )}

          {authAdmin ? (
            <button
              onClick={handleAdminLogout}
              className="luxury-btn secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.65rem', letterSpacing: '0.1em' }}
            >
              ADMIN LOGOUT
            </button>
          ) : authNominee ? (
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
      )}

      <div style={{ paddingTop: isOverlayOpen ? '2rem' : '8.5rem' }}>
        {/* FOOTER PAGES */}
        {currentPage && !authAdmin && !authNominee && (
        <>
          {currentPage === 'about' && <AboutPage onBack={handleBackToPortal} />}
          {currentPage === 'help' && <HelpSupportPage onBack={handleBackToPortal} />}
          {currentPage === 'guidelines' && <GuidelinesPage onBack={handleBackToPortal} />}
          {currentPage === 'terms' && <TermsPage onBack={handleBackToPortal} />}
          {currentPage === 'privacy' && <PrivacyPage onBack={handleBackToPortal} />}
          {currentPage === 'payment' && <PaymentPage onBack={handleBackToPortal} />}
          {currentPage === 'payment-status' && <PaymentStatusPage onBack={handleBackToPortal} onGoToVote={() => navigateToTab('vote')} onGoToTickets={() => navigateToTab('tickets')} />}
          {currentPage === 'not-found' && <NotFoundPage />}
        </>
      )}

      {/* SECURE DASHBOARDS OR PUBLIC LIST */}
      {!currentPage && authAdmin && (
        <Suspense fallback={<div className="loading-copy" style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-secondary)' }}>Loading admin console...</div>}>
          <AdminDashboard
            token={authAdmin.token}
            onLogout={handleAdminLogout}
            categories={categories}
            nominees={nominees}
            refreshData={loadData}
            wsTrigger={wsTrigger}
          />
        </Suspense>
      )}

      {!currentPage && authNominee?.nominee?.code && authNominee?.token && (
        <Suspense fallback={<div className="loading-copy" style={{ textAlign: 'center', padding: '6rem 0', color: 'var(--text-secondary)' }}>Loading dashboard...</div>}>
          <NomineeDashboard
            code={authNominee.nominee.code}
            token={authNominee.token}
            onLogout={handleLogout}
            copyShareLink={copyShareLink}
            dialUssdCode={dialUssdCode}
            wsTrigger={wsTrigger}
          />
        </Suspense>
      )}

      {!currentPage && !authAdmin && !authNominee && activeTab === 'leaderboard' && (
        /* PUBLIC LEADERBOARD PAGE */
        <div className="leaderboard-page-container" style={{ animation: 'fadeIn 0.6s ease', maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 4rem 1.5rem' }}>
          <div className="editorial-header-section">

            <span className="editorial-tagline">
              {activeEvent ? `${displayEventTitle(activeEvent).toUpperCase()} LIVE STANDINGS` : 'LIVE STANDINGS'}
            </span>
            <h1 className="editorial-title">LEADERBOARD</h1>
            {formatEventDate(activeEvent) && (
              <p style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: 'var(--accent)', marginTop: '0.50rem', fontWeight: 600 }}>
                {formatEventDate(activeEvent)}
              </p>
            )}
            <div className="editorial-divider" />
          </div>

          <div>
            {BRANDING.leaderboardLocked ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '4rem 2rem',
                background: 'rgba(255, 255, 255, 0.02)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                textAlign: 'center',
                marginTop: '1.5rem',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(212, 175, 55, 0.08)',
                  border: '1px solid var(--accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
                <h2 style={{
                  fontFamily: '"Cinzel", serif',
                  letterSpacing: '0.08em',
                  color: '#fff',
                  fontSize: '1.4rem',
                  marginBottom: '1rem',
                  textTransform: 'uppercase'
                }}>
                  Standings Frozen
                </h2>
                <p style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.88rem',
                  lineHeight: '1.6',
                  maxWidth: '460px',
                  margin: '0 auto 1.5rem auto'
                }}>
                  Standings and vote counts are currently locked until the official announcement at the dinner and awards night. Supported candidates will receive all votes during this time!
                </p>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '0.5rem 1rem',
                  background: 'rgba(212, 175, 55, 0.04)',
                  border: '1px dashed rgba(212, 175, 55, 0.25)',
                  borderRadius: '4px',
                  fontSize: '0.78rem',
                  color: 'var(--accent)',
                  letterSpacing: '0.06em',
                  fontWeight: 600
                }}>
                  <span style={{ marginRight: '0.5rem', display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)' }}></span>
                  VOTING REMAINS ACTIVE
                </div>
                <button 
                  onClick={() => navigateToTab('vote')}
                  className="luxury-btn"
                  style={{ marginTop: '2rem', padding: '0.75rem 2.5rem' }}
                >
                  CONTINUE VOTING
                </button>
              </div>
            ) : (
              <>
                {!loading && categories.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <CategoryBrowser
                      categories={categories}
                      selectedCategory={selectedCategory}
                      onSelectCategory={handleCategorySelect}
                      getCount={getCategoryCount}
                      showCounts={hasPublishedNominees}
                      layout="list"
                    />
                  </div>
                )}
                {!loading && !hasPublishedNominees && (
                  <AwaitingNomineesPanel compact selectedCategoryName={selectedCategoryName} onViewTickets={() => navigateToTab('tickets')} />
                )}
                <div ref={leaderboardResultsRef} className="vote-results-anchor" aria-live="polite" />
                {hasPublishedNominees && (
                  <LeaderboardPanel
                    categories={categoriesWithNominees}
                    nominees={eventScopedNominees}
                    selectedCategory={selectedCategory}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {!currentPage && !authAdmin && !authNominee && activeTab === 'tickets' && (
        <EventsTicketsPage 
          isTab={true} 
          activeEventId={activeEventId}
          onBack={handleBackToPortal} 
          onPaymentRedirect={handlePaymentRedirect} 
        />
      )}

      {!currentPage && !authAdmin && !authNominee && activeTab === 'vote' && (
        /* PUBLIC VOTING LANDING PAGE */
      <div>
        {/* Hero Marquee Section */}
        <div className="editorial-header-section">
          <span className="editorial-tagline">
            {BRANDING.organizerFullName.toUpperCase()} · {BRANDING.university.toUpperCase()}
          </span>
          <div style={{
            fontSize: '0.65rem',
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: 'var(--text-secondary)',
            fontWeight: 500,
            margin: '0.75rem 0 1rem 0',
            opacity: 0.8
          }}>
            Presents
          </div>
          <h1 className="editorial-title">
            {displayEventTitle(activeEvent).toUpperCase()}
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '560px', margin: '0.75rem auto 0', lineHeight: 1.6 }}>
            Official voting and ticketing by {BRANDING.platformName} for {BRANDING.organizerName}, {BRANDING.campus}.
          </p>
          {formatEventDate(activeEvent) && (
            <p style={{ fontSize: '0.75rem', letterSpacing: '0.12em', color: 'var(--accent)', marginTop: '0.75rem', fontWeight: 600 }}>
              {formatEventDate(activeEvent)}
            </p>
          )}
          <div className="editorial-divider" />
        </div>

        {categories.length > 0 && (
          <PublicVoteFilters
            events={events}
            activeEventId={activeEventId}
            onEventChange={handleEventChange}
            categories={categories}
            selectedCategory={selectedCategory}
            onSelectCategory={handleCategorySelect}
            getCount={getCategoryCount}
            showCounts={hasPublishedNominees}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={hasPublishedNominees}
          />
        )}

        <div ref={voteResultsRef} className="vote-results-anchor" aria-live="polite" />

        {/* Loading Indicator */}
        {loadError && (
          <div className="editorial-sheet" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem 2rem', marginBottom: '2rem', borderColor: 'rgba(244, 67, 54, 0.3)' }}>
            <h3 style={{ color: '#f44336', marginBottom: '0.75rem' }}>Unable to load catalog</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{loadError}</p>
            <button type="button" className="luxury-btn" onClick={() => { setLoading(true); loadData(); }}>Retry</button>
          </div>
        )}

        {loading && !hasPublishedNominees && !loadError ? (
          <div style={{ textAlign: 'center', padding: '6rem 0' }}>
            <h2 className="loading-copy" style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
              Catalog Loading...
            </h2>
          </div>
        ) : !loadError && !hasPublishedNominees ? (
          <AwaitingNomineesPanel selectedCategoryName={selectedCategoryName} onViewTickets={() => navigateToTab('tickets')} />
        ) : !loadError ? (
          /* Nominees Editorial Column Grid */
          <div className="editorial-grid">
            {filteredNominees.length === 0 ? (
              <div className="editorial-sheet no-results-copy" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem 2rem' }}>
                <h3 style={{ fontSize: '1.2rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  No results found
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {selectedCategoryName
                    ? `No nominees in ${selectedCategoryName} yet. Try another category or clear your search.`
                    : 'Try adjusting your search or category filter.'}
                </p>
              </div>
            ) : (
              visibleVoteNominees.map(nom => (
                <div key={nom.id} className="editorial-card">
                  {/* Visual Portrait */}
                  <div className="editorial-image-wrapper">
                    <img src={nomineePhotoSrc(nom.photo_url)} alt={nom.name} loading="lazy" decoding="async" />
                    <div className="editorial-card-ref-wrap">
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

                    <div className="editorial-card-secondary-actions" style={{ display: 'flex', justifyContent: BRANDING.showUssd ? 'space-between' : 'flex-end', alignItems: 'center', marginTop: '0.5rem' }}>
                      {BRANDING.showUssd && (
                        <button
                          onClick={() => dialUssdCode(getNomineeUssdCode(nom.code))}
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
                          DIAL {getNomineeUssdCode(nom.code)}
                        </button>
                      )}

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
            {hasMoreVoteNominees && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="luxury-btn secondary load-more-nominees-btn"
                  onClick={() => setVoteGridVisibleCount((count) => count + VOTE_GRID_PAGE_SIZE)}
                  style={{ padding: '0.85rem 2rem', fontSize: '0.75rem' }}
                >
                  LOAD MORE NOMINEES ({filteredNominees.length - voteGridVisibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
      )}
      </div>

      {/* Editorial Luxury Footer */}
      {!authAdmin && !authNominee && (
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
                {BRANDING.eventTitle.toUpperCase()}
              </h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', fontSize: '0.75rem' }}>
                {BRANDING.organizerFullName}, {BRANDING.department}, {BRANDING.university}, {BRANDING.campus}.
                Voting and ticketing powered by {BRANDING.platformName}.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '4rem', flexWrap: 'wrap' }}>
              <div>
                <h4 style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  Quick Links
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                  <li><a href="#/about" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('about'); window.scrollTo(0, 0); }}>About the Awards</a></li>
                  <li><a href="#/help" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('help'); window.scrollTo(0, 0); }}>Help & Support</a></li>
                  <li><a href="#/guidelines" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('guidelines'); window.scrollTo(0, 0); }}>Nominee Guidelines</a></li>
                  <li>
                    <a href="#/tickets" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToTab('tickets'); window.scrollTo(0, 0); }}>
                      Awards Night Tickets
                      {!BRANDING.ticketsEnabled && (
                        <span style={{ display: 'block', fontSize: '0.65rem', opacity: 0.75, marginTop: '0.15rem' }}>Not on sale yet</span>
                      )}
                    </a>
                  </li>
                  <li><a href="#/payment-status" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('payment-status'); window.scrollTo(0, 0); }}>Payment Status</a></li>
                </ul>
              </div>

              <div>
                <h4 style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-primary)', marginBottom: '1rem' }}>
                  Legal & Security
                </h4>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: 0 }}>
                  <li><a href="#/terms" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('terms'); window.scrollTo(0, 0); }}>Terms & Conditions</a></li>
                  <li><a href="#/privacy" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('privacy'); window.scrollTo(0, 0); }}>Privacy Policy</a></li>
                  <li><a href="#/payment" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem' }} onClick={(e) => { e.preventDefault(); navigateToPage('payment'); window.scrollTo(0, 0); }}>Payment Protection</a></li>
                  <li><button type="button" onClick={() => setAdminLoginMode(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.75rem', padding: 0, cursor: 'pointer' }}>Admin Console</button></li>
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
            <span>&copy; {new Date().getFullYear()} {BRANDING.platformName.toUpperCase()} · {BRANDING.organizerName} {BRANDING.eventTitle}</span>
          </div>
        </footer>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODALS REGISTRY */}
      {/* ---------------------------------------------------- */}

      {/* Nominee Login Modal */}
      {loginMode && (
        <div className="luxury-modal-overlay" role="dialog" aria-modal="true">
          <div className="luxury-modal" style={{ maxWidth: '420px' }}>
            <div className="luxury-modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Nominee Access</h2>
              <button
                onClick={() => { setLoginMode(false); setLoginError(''); }}
                className="modal-close-btn"
                aria-label="Close"
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
                <button type="submit" disabled={loginSubmitting} className={`luxury-btn ${loginSubmitting ? 'disabled' : ''}`} style={{ width: '100%' }}>
                  {loginSubmitting ? 'Signing in...' : 'Unlock Dashboard'}
                </button>
              </form>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>First time logging in? </span>
                <button
                  onClick={() => { setLoginMode(false); setRegisterMode(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', textDecoration: 'underline', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Activate Nominee PIN
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nominee Registration / PIN Activation Modal */}
      {registerMode && (
        <div className="luxury-modal-overlay" role="dialog" aria-modal="true">
          <div className="luxury-modal" style={{ maxWidth: '420px' }}>
            <div className="luxury-modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Activate Nominee PIN</h2>
              <button
                onClick={() => { setRegisterMode(false); setRegisterError(''); setRegisterSuccess(''); }}
                className="modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="luxury-modal-body">
              {registerError && (
                <div style={{
                  background: 'var(--accent-light)',
                  borderLeft: '3px solid var(--accent)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  color: 'var(--accent-dark)',
                  marginBottom: '1.5rem',
                  fontWeight: 500
                }}>
                  {registerError}
                </div>
              )}
              {registerSuccess && (
                <div style={{
                  background: '#e2f9eb',
                  borderLeft: '3px solid #2ecc71',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  color: '#27ae60',
                  marginBottom: '1.5rem',
                  fontWeight: 500
                }}>
                  {registerSuccess}
                </div>
              )}
              <form onSubmit={handleNomineeRegister}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Nominee Code
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101"
                    value={registerCode}
                    onChange={(e) => setRegisterCode(e.target.value)}
                    className="luxury-input"
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    Enter the candidate reference code.
                  </span>
                </div>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Temporary Activation PIN
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123456"
                    value={registerActivationCode}
                    onChange={(e) => setRegisterActivationCode(e.target.value)}
                    className="luxury-input"
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                    Enter the 6-digit activation PIN provided by your system admin.
                  </span>
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Choose a 4 to 6 digit Personal Login PIN
                  </label>
                  <input
                    type="password"
                    required
                    maxLength={6}
                    placeholder="e.g. 9876"
                    value={registerPin}
                    onChange={(e) => setRegisterPin(e.target.value)}
                    className="luxury-input"
                  />
                </div>
                <button type="submit" className="luxury-btn" style={{ width: '100%' }}>
                  Activate and Set Personal PIN
                </button>
              </form>
              <div style={{ marginTop: '1.5rem', textAlign: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Already activated? </span>
                <button
                  onClick={() => { setRegisterMode(false); setLoginMode(true); }}
                  style={{ background: 'none', border: 'none', color: 'var(--accent-dark)', textDecoration: 'underline', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Log In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login Modal */}
      {adminLoginMode && (
        <div className="luxury-modal-overlay" role="dialog" aria-modal="true">
          <div className="luxury-modal" style={{ maxWidth: '420px' }}>
            <div className="luxury-modal-header">
              <h2 style={{ fontSize: '1.25rem' }}>Admin Authentication</h2>
              <button
                onClick={() => { setAdminLoginMode(false); setAdminLoginError(''); }}
                className="modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="luxury-modal-body">
              {adminLoginError && (
                <div style={{
                  background: 'var(--accent-light)',
                  borderLeft: '3px solid var(--accent)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8rem',
                  color: 'var(--accent-dark)',
                  marginBottom: '1.5rem',
                  fontWeight: 500
                }}>
                  {adminLoginError}
                </div>
              )}
              <form onSubmit={handleAdminLogin}>
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Admin Username
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. admin"
                    value={adminUsername}
                    onChange={(e) => setAdminUsername(e.target.value)}
                    className="luxury-input"
                  />
                </div>
                <div style={{ marginBottom: '2rem' }}>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="luxury-input"
                  />
                </div>
                <button type="submit" className="luxury-btn" style={{ width: '100%' }}>
                  Access Console
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Control Center Drawer overlay */}
      {mobileMenuOpen && (
        <div className="control-center-overlay" onClick={() => setMobileMenuOpen(false)} role="dialog" aria-modal="true">
          <div className="control-center-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="control-center-header">
              <h3 style={{ fontSize: '1.1rem', letterSpacing: '0.05em' }}>Control Panel</h3>
              <button className="control-center-close" onClick={() => setMobileMenuOpen(false)} aria-label="Close mobile menu" type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            <div className="control-center-body">
              {/* Mobile Navigation Tabs */}
              {!authAdmin && !authNominee && (
                <div className="control-center-section" style={{ marginBottom: '1.5rem' }}>
                  <span className="section-label">Navigation</span>
                  <div className="control-center-nav-grid">
                    <button
                      onClick={() => { navigateToTab('vote'); setMobileMenuOpen(false); }}
                      className={`control-theme-btn control-nav-btn ${activeTab === 'vote' && !currentPage ? 'active' : ''}`}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2 2V5a2 2 0 0 1 2-2h11" /></svg>
                      <span>Vote</span>
                    </button>
                    <button
                      onClick={() => { navigateToTab('leaderboard'); setMobileMenuOpen(false); }}
                      className={`control-theme-btn control-nav-btn ${activeTab === 'leaderboard' && !currentPage ? 'active' : ''}`}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" /><path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z" /></svg>
                      <span>Leaderboard</span>
                    </button>
                    <button
                      onClick={() => { navigateToTab('tickets'); setMobileMenuOpen(false); }}
                      className={`control-theme-btn control-nav-btn ${activeTab === 'tickets' && !currentPage ? 'active' : ''}`}
                      type="button"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="14" x2="8" y2="14.01" /><line x1="12" y1="14" x2="12" y2="14.01" /><line x1="16" y1="14" x2="16" y2="14.01" /></svg>
                      <span>
                        Tickets
                        {!BRANDING.ticketsEnabled && (
                          <span style={{ display: 'block', fontSize: '0.58rem', opacity: 0.7, letterSpacing: '0.04em' }}>Not open</span>
                        )}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {!authAdmin && !authNominee && (
                <div className="control-center-section" style={{ marginBottom: '1.5rem' }}>
                  <span className="section-label">Resources</span>
                  <div className="control-center-pages-grid">
                    {MOBILE_MENU_PAGES.map(p => (
                      <button
                        key={p.id}
                        onClick={() => { navigateToPage(p.id); setMobileMenuOpen(false); }}
                        className={`control-theme-btn control-page-btn ${currentPage === p.id ? 'active' : ''}`}
                        type="button"
                      >
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                  <p className="control-center-footnote">
                    Legal, privacy, payment status, and nominee application links are in the site footer.
                  </p>
                </div>
              )}

              <div className="control-center-section">
                <span className="section-label">Color Theme</span>
                <p className="theme-active-banner">
                  Active: <strong>{activeTheme.name}</strong>
                </p>
                <div className="control-theme-picker">
                  {COLOR_THEMES.map((theme) => (
                    <button
                      key={theme.value}
                      onClick={() => { changeAccent(theme.value); }}
                      className={`control-theme-btn ${accent === theme.value ? 'active' : ''}`}
                      aria-label={`${theme.name} theme`}
                      aria-pressed={accent === theme.value}
                      type="button"
                    >
                      <span className="color-dot" style={{ backgroundColor: theme.value }} />
                      <span className="color-name">{theme.name}</span>
                      {accent === theme.value && <span className="theme-check" aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="control-center-section" style={{ marginTop: '1.5rem' }}>
                <span className="section-label">Account</span>
                <div className="control-actions-grid">
                  {authAdmin ? (
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleAdminLogout(); }}
                      className="control-action-card active"
                      type="button"
                    >
                      <span className="card-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      </span>
                      <span className="card-title">Admin Logout</span>
                      <span className="card-desc">Console Session</span>
                    </button>
                  ) : authNominee ? (
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                      className="control-action-card active"
                      type="button"
                    >
                      <span className="card-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                      </span>
                      <span className="card-title">Nominee Logout</span>
                      <span className="card-desc">Code: {authNominee.nominee.code}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => { setMobileMenuOpen(false); setLoginMode(true); }}
                        className="control-action-card"
                        type="button"
                      >
                        <span className="card-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                        </span>
                        <span className="card-title">Nominee Login</span>
                        <span className="card-desc">Dashboard access</span>
                      </button>

                      <button
                        onClick={() => { setMobileMenuOpen(false); setRegisterMode(true); }}
                        className="control-action-card"
                        type="button"
                      >
                        <span className="card-icon">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                        </span>
                        <span className="card-title">Register PIN</span>
                        <span className="card-desc">Activate nominee code</span>
                      </button>

                    </>
                  )}
                </div>
              </div>
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

      {/* Secure Payment Checkout Screen */}
      {checkoutData && (
        <MockPaystack
          checkoutData={checkoutData}
          onComplete={handlePaymentSuccess}
          onCancel={() => setCheckoutData(null)}
        />
      )}

      {/* FLOATING SHORTCODE DIALER WIDGET (dev only) */}
      {import.meta.env.DEV && BRANDING.showUssd && ussdOpen && (
        <div className="ussd-device-frame">
          <div className="ussd-device-header">
            <span>SHORTCODE DIALER</span>
            <button
              onClick={() => setUssdOpen(false)}
              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.9rem' }}
              aria-label="Close"
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
                <div style={{ color: '#aaa', textAlign: 'center', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Dial the official shortcode to begin:<br /><br />
                  • <strong>{BRANDING.ussdShortcode}</strong> (Voteeq Portal)<br />
                  {nominees.length > 0 ? (
                    nominees.slice(0, 3).map(nom => (
                      <div key={nom.id} style={{ marginTop: '0.25rem' }}>
                        • <strong>{getNomineeUssdCode(nom.code)}</strong> (Vote for {nom.name})
                      </div>
                    ))
                  ) : (
                    <div style={{ marginTop: '0.25rem' }}>Loading nominee codes...</div>
                  )}
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
                  onClick={() => initUssdSession(BRANDING.ussdShortcode)}
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
                  onClick={() => initUssdSession(getNomineeUssdCode(nominees[0]?.code || '101'))}
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
                  DIAL *{nominees[0]?.code || '101'}#
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
