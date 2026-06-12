import { useState, useEffect, useCallback, useRef } from 'react';
import { API_BASE_URL } from '../config';
import { BRANDING, formatEventDate, formatEventMeta } from '../branding';
import { authFetch } from '../utils/api';

export default function AdminDashboard({ token, onLogout, categories, nominees, refreshData, wsTrigger }) {
  const [stats, setStats] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [alertDialog, setAlertDialog] = useState(null);
  const [fetchError, setFetchError] = useState('');
  const [loadingStats, setLoadingStats] = useState(true);
  const [registrations, setRegistrations] = useState([]);
  
  // Create category form states
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [catError, setCatError] = useState('');
  const [catSuccess, setCatSuccess] = useState('');

  // Create nominee form states
  const [newNomCode, setNewNomCode] = useState('');
  const [newNomName, setNewNomName] = useState('');
  const [newNomPhoto, setNewNomPhoto] = useState('');
  const [newNomCategoryId, setNewNomCategoryId] = useState('');
  const [nomError, setNomError] = useState('');
  const [nomSuccess, setNomSuccess] = useState('');
  const [createdActivationCode, setCreatedActivationCode] = useState('');
  const [newNomEventId, setNewNomEventId] = useState('');

  // Active sub-view tab: 'overview', 'nominees', 'categories'
  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Event & Ticketing states
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [eventsList, setEventsList] = useState([]);
  
  const [scanCode, setScanCode] = useState('');
  const [selectedTestTicket, setSelectedTestTicket] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');

  // Event Form States
  const [editingEventId, setEditingEventId] = useState(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDesc, setEventDesc] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventVenue, setEventVenue] = useState('');
  const [eventPrice, setEventPrice] = useState(0);
  const [eventPrivacy, setEventPrivacy] = useState('public');
  const [eventAccessCode, setEventAccessCode] = useState('');
  const [eventCapacity, setEventCapacity] = useState(100);
  const [eventError, setEventError] = useState('');
  const [eventSuccess, setEventSuccess] = useState('');

  // Audit Logs States
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [reseedLoading, setReseedLoading] = useState(false);
  const [reseedMessage, setReseedMessage] = useState('');
  const wsTriggerRef = useRef(wsTrigger);

  const fetchStats = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, onLogout);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setFetchError('');
      } else if (res.status !== 401 && res.status !== 403) {
        setFetchError('Failed to load admin overview.');
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
      setFetchError('Network error loading admin data.');
    } finally {
      setLoadingStats(false);
    }
  }, [token, onLogout]);

  const fetchRegistrations = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/registrations', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, onLogout);
      if (res.ok) {
        const data = await res.json();
        setRegistrations(data);
      }
    } catch (err) {
      console.error('Failed to load registrations:', err);
    }
  }, [token, onLogout]);

  const fetchTicketsData = useCallback(async () => {
    try {
      setLoadingTickets(true);
      const resTickets = await authFetch('/api/admin/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, onLogout);
      const resEvents = await authFetch('/api/events', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, onLogout);
      
      if (resTickets.ok && resEvents.ok) {
        const ticketsData = await resTickets.json();
        const eventsData = await resEvents.json();
        setTickets(ticketsData);
        setEventsList(eventsData);
      }
    } catch (err) {
      console.error('Failed to load tickets data:', err);
    } finally {
      setLoadingTickets(false);
    }
  }, [token, onLogout]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setLoadingAudit(true);
      const res = await authFetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      }, onLogout);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  }, [token, onLogout]);

  const handleScanTicket = async (codeToScan) => {
    const targetCode = codeToScan || scanCode;
    if (!targetCode) {
      setScanError('Please enter or select a ticket code to scan.');
      return;
    }
    
    setScanning(true);
    setScanError('');
    setScanResult(null);
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tickets/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ticket_code: targetCode.trim() })
      });
      
      const data = await res.json();
      if (res.ok) {
        setScanResult({ success: true, ...data });
        setScanCode('');
        setSelectedTestTicket('');
        fetchTicketsData();
      } else {
        setScanResult({ success: false, error: data.error || 'Check-in failed' });
      }
    } catch (err) {
      setScanResult({ success: false, error: err.message || 'Network error scanning ticket' });
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchStats();
      fetchRegistrations();
      if (activeSubTab === 'tickets' || activeSubTab === 'events' || activeSubTab === 'nominees') {
        fetchTicketsData();
      }
      if (activeSubTab === 'audit') {
        fetchAuditLogs();
      }
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [fetchStats, fetchRegistrations, fetchTicketsData, fetchAuditLogs, activeSubTab]);

  useEffect(() => {
    if (wsTriggerRef.current === wsTrigger) return;
    wsTriggerRef.current = wsTrigger;
    fetchStats();
  }, [wsTrigger, fetchStats]);

  const handleApproveRegistration = (id) => {
    setConfirmDialog({
      message: 'Are you sure you want to approve this nominee registration application?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/registrations/${id}/approve`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to approve application');
          
          setAlertDialog({
            title: 'Onboarding Approved!',
            message: (
              <div>
                <p>The candidate application has been approved.</p>
                <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '4px', fontFamily: 'monospace' }}>
                  <p><strong>Nominee Code:</strong> {data.assignedCode}</p>
                </div>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '0.75rem' }}>
                  The activation PIN was sent via your notification channel. Share the nominee code with the applicant.
                </p>
              </div>
            )
          });
          
          fetchRegistrations();
          refreshData();
          fetchStats();
        } catch (err) {
          setAlertDialog({
            title: 'Error',
            message: err.message
          });
        }
      }
    });
  };

  const handleRejectRegistration = (id) => {
    setConfirmDialog({
      message: 'Are you sure you want to reject this application?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/registrations/${id}/reject`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to reject application');
          fetchRegistrations();
        } catch (err) {
          setAlertDialog({
            title: 'Error',
            message: err.message
          });
        }
      }
    });
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    setCatError('');
    setCatSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newCatName, description: newCatDesc })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create category');
      
      setCatSuccess(data.message);
      setNewCatName('');
      setNewCatDesc('');
      refreshData();
    } catch (err) {
      setCatError(err.message);
    }
  };

  const handleDeleteCategory = (id) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this category?',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/categories/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete category');
          refreshData();
        } catch (err) {
          setAlertDialog({
            title: 'Error',
            message: err.message
          });
        }
      }
    });
  };

  const handleCreateNominee = async (e) => {
    e.preventDefault();
    setNomError('');
    setNomSuccess('');
    setCreatedActivationCode('');
    if (!newNomCategoryId) {
      setNomError('Please select a category');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/nominees`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
          body: JSON.stringify({
          code: newNomCode,
          name: newNomName,
          photo_url: newNomPhoto,
          category_id: parseInt(newNomCategoryId),
          event_id: newNomEventId ? parseInt(newNomEventId) : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add nominee');
      
      setNomSuccess(data.message);
      if (data.activationCode) {
        setCreatedActivationCode(data.activationCode);
      }
      setNewNomCode('');
      setNewNomName('');
      setNewNomPhoto('');
      setNewNomCategoryId('');
      setNewNomEventId('');
      refreshData();
    } catch (err) {
      setNomError(err.message);
    }
  };

  const handleDeleteNominee = (id) => {
    setConfirmDialog({
      message: 'Are you sure you want to delete this nominee? All their votes will also be deleted.',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API_BASE_URL}/api/admin/nominees/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete nominee');
          refreshData();
        } catch (err) {
          setAlertDialog({
            title: 'Error',
            message: err.message
          });
        }
      }
    });
  };

  return (
    <div className="admin-dashboard-container" style={{ animation: 'fadeIn 0.6s ease' }}>
      {fetchError && (
        <div style={{ marginBottom: '1.5rem', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(244, 67, 54, 0.3)', color: '#c62828', fontSize: '0.85rem' }}>
          {fetchError}
        </div>
      )}
      {/* Header Panel */}
      <div className="dashboard-header-card" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', padding: '2rem', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '24px' }}>
        <div>
          <span className="ref-badge" style={{ marginBottom: '0.5rem' }}>
            System Console
          </span>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2.2rem', fontWeight: 400, letterSpacing: '0.02em' }}>
            Admin Dashboard
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '0.25rem' }}>
            Manage Categories and Nominees
          </p>
        </div>
        <button onClick={onLogout} className="luxury-btn secondary" style={{ padding: '0.6rem 1.2rem', fontSize: '0.65rem' }}>
          Logout
        </button>
      </div>

      {/* Nav Sub-Tabs */}
      <div className="category-tabs" style={{ marginBottom: '2.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', overflowX: 'auto', display: 'flex', gap: '0.75rem' }}>
        <button 
          className={`category-tab-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'nominees' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('nominees')}
        >
          Nominees ({nominees.length})
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'categories' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('categories')}
        >
          Categories ({categories.length})
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'registrations' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('registrations')}
        >
          Applications ({registrations.filter(r => r.approval_status === 'pending').length})
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'tickets' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('tickets')}
        >
          Tickets & Scanner
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('events')}
        >
          Manage Events
        </button>
        <button 
          className={`category-tab-btn ${activeSubTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('audit')}
        >
          Audit Logs
        </button>
      </div>

      {/* 1. OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          <div className="editorial-sheet" style={{ margin: 0, padding: '1.5rem 2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', marginBottom: '0.5rem' }}>ASCES AWARDS '26 catalog</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
              Reset the portal for ASCES AWARDS '26. Clears votes, tickets, and registrations, then loads the ticketed event and 28 award categories. Add nominees per category when ASCES provides the shortlist.
            </p>
            {reseedMessage && (
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1rem', fontWeight: 500 }}>{reseedMessage}</p>
            )}
            <button
              type="button"
              disabled={reseedLoading}
              className={`luxury-btn secondary ${reseedLoading ? 'disabled' : ''}`}
              style={{ fontSize: '0.7rem' }}
              onClick={() => {
                setConfirmDialog({
                  message: "Reset for ASCES AWARDS '26? All current events, nominees, votes, tickets, and pending applications will be removed.",
                  onConfirm: async () => {
                    setReseedLoading(true);
                    setReseedMessage('');
                    try {
                      const res = await fetch(`${API_BASE_URL}/api/admin/demo/reseed-asces`, {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Reseed failed');
                      setReseedMessage(data.message || "ASCES AWARDS '26 loaded.");
                      fetchStats();
                      fetchRegistrations();
                      fetchTicketsData();
                      refreshData();
                    } catch (err) {
                      setReseedMessage(err.message || 'Failed to reset ASCES catalog.');
                    } finally {
                      setReseedLoading(false);
                    }
                  },
                });
              }}
            >
              {reseedLoading ? 'Resetting...' : "Reset for ASCES AWARDS '26"}
            </button>
          </div>

          {/* Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
            <div className="metric-box-glow" style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Categories</span>
              <h2 style={{ fontSize: '2.6rem', marginTop: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                {loadingStats ? '...' : (stats?.categoriesCount || 0)}
              </h2>
              <div style={{ width: '100%', height: '2px', background: 'var(--accent)', opacity: 0.3, position: 'absolute', bottom: 0, left: 0 }} />
            </div>

            <div className="metric-box-glow" style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Nominees</span>
              <h2 style={{ fontSize: '2.6rem', marginTop: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                {loadingStats ? '...' : (stats?.nomineesCount || 0)}
              </h2>
              <div style={{ width: '100%', height: '2px', background: 'var(--accent)', opacity: 0.3, position: 'absolute', bottom: 0, left: 0 }} />
            </div>

            <div className="metric-box-glow" style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total Votes</span>
              <h2 style={{ fontSize: '2.6rem', marginTop: '0.5rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                {loadingStats ? '...' : (stats?.totalVotes || 0)}
              </h2>
              <div style={{ width: '100%', height: '2px', background: 'var(--accent)', opacity: 0.3, position: 'absolute', bottom: 0, left: 0 }} />
            </div>

            <div className="metric-box-glow" style={{ padding: '1.75rem', background: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Total Revenue</span>
              <h2 style={{ fontSize: '2.6rem', marginTop: '0.5rem', color: 'var(--accent)', fontFamily: 'var(--font-serif)' }}>
                {loadingStats ? '...' : `${(stats?.totalRevenue || 0).toFixed(2)} GHS`}
              </h2>
              <div style={{ width: '100%', height: '2px', background: 'var(--accent)', position: 'absolute', bottom: 0, left: 0 }} />
            </div>
          </div>

          {/* Channels breakdown */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Votes by Channel</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>Online (Web)</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{stats?.channelStats?.web || 0} votes ({((stats?.channelStats?.web || 0) * 1.00).toFixed(2)} GHS)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className="metric-progress-fill" style={{ height: '100%', background: 'var(--accent)', width: `${stats?.totalVotes ? ((stats.channelStats?.web || 0) / stats.totalVotes) * 100 : 0}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>USSD Dialer</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{stats?.channelStats?.ussd || 0} votes ({((stats?.channelStats?.ussd || 0) * 0.50).toFixed(2)} GHS)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div className="metric-progress-fill" style={{ height: '100%', background: 'var(--accent-dark)', width: `${stats?.totalVotes ? ((stats.channelStats?.ussd || 0) / stats.totalVotes) * 100 : 0}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Database Status</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>SQLite connection status</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px' }}>
                <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-dark)', display: 'block' }}>Connected</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Operational. All data syncs running smoothly.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. NOMINEES */}
      {activeSubTab === 'nominees' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>
          {/* Add Nominee Panel */}
          <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Add Nominee</h3>
            
            {nomError && <div style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1.5rem', fontWeight: 500 }}>{nomError}</div>}
            {nomSuccess && (
              <div style={{ background: '#e2f9eb', borderLeft: '3px solid #2ecc71', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', color: '#27ae60' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, margin: 0 }}>{nomSuccess}</p>
                {createdActivationCode && (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(46, 204, 113, 0.15)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                    <div>
                      <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#1e8449', display: 'block', fontWeight: 700 }}>
                        Temporary Activation Code (Share Securely)
                      </span>
                      <strong style={{ fontSize: '1.1rem', fontFamily: 'monospace', color: '#196f3d', letterSpacing: '0.1em' }}>
                        {createdActivationCode}
                      </strong>
                    </div>
                    <button 
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(createdActivationCode);
                        setAlertDialog({
                          title: 'Copied!',
                          message: 'Activation code copied to clipboard successfully.'
                        });
                      }}
                      className="luxury-btn"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem', background: 'var(--accent)', color: '#fff', border: 'none', height: 'auto', borderRadius: '6px' }}
                    >
                      Copy
                    </button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleCreateNominee} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Nominee Code</label>
                <input type="text" placeholder="e.g. 104" required value={newNomCode} onChange={e => setNewNomCode(e.target.value)} className="luxury-input" style={{ borderRadius: '8px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Name</label>
                <input type="text" placeholder="e.g. Wendy Shay" required value={newNomName} onChange={e => setNewNomName(e.target.value)} className="luxury-input" style={{ borderRadius: '8px' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Category</label>
                <select required value={newNomCategoryId} onChange={e => setNewNomCategoryId(e.target.value)} className="luxury-select" style={{ width: '100%', height: '43px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Event Context</label>
                <select value={newNomEventId} onChange={e => setNewNomEventId(e.target.value)} className="luxury-select" style={{ width: '100%', height: '43px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.75rem' }}>
                  <option value="">Default Event</option>
                  {eventsList.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Photo URL (Optional)</label>
                <input type="url" placeholder="https://unsplash.com/..." value={newNomPhoto} onChange={e => setNewNomPhoto(e.target.value)} className="luxury-input" style={{ borderRadius: '8px' }} />
              </div>

              <div>
                <button type="submit" className="luxury-btn" style={{ width: '100%', height: '43px', borderRadius: '8px' }}>
                  Add Nominee
                </button>
              </div>
            </form>
          </div>

          {/* Nominees Grid Table */}
          <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Nominees Directory</h3>
            
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Nominee Candidate</th>
                  <th>Award Category</th>
                  <th>Votes Verified</th>
                  <th>PIN Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nominees.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No nominees registered in SQLite database.
                    </td>
                  </tr>
                ) : (
                  nominees.map(n => (
                    <tr key={n.id}>
                      <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{n.code}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <img src={n.photo_url} alt={n.name} style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                          <span style={{ fontWeight: 500 }}>{n.name}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{n.category_name}</td>
                      <td style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>{n.votes_count}</td>
                      <td>
                        {n.passcode === 'PENDING' || (n.passcode && n.passcode.startsWith('PENDING_ACT_')) ? (
                          <span style={{ background: '#fef9e7', color: '#f39c12', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(243, 156, 18, 0.2)' }}>
                            Pending Setup
                          </span>
                        ) : (
                          <span style={{ background: '#e8f8f5', color: '#2ecc71', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                            Activated
                          </span>
                        )}
                      </td>
                      <td>
                        <button 
                          onClick={() => handleDeleteNominee(n.id)}
                          style={{ background: 'none', border: 'none', color: '#e74c3c', textDecoration: 'underline', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                        >
                          Delete Nominee
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CATEGORIES MANAGEMENT */}
      {activeSubTab === 'categories' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>
          {/* Add Category Panel */}
          <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Add Category</h3>
            
            {catError && <div style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1.5rem', fontWeight: 500 }}>{catError}</div>}
            {catSuccess && <div style={{ background: '#e2f9eb', borderLeft: '3px solid #2ecc71', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#27ae60', marginBottom: '1.5rem', fontWeight: 500 }}>{catSuccess}</div>}

            <form onSubmit={handleCreateCategory} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Category Name</label>
                <input type="text" placeholder="e.g. Producer of the Year" required value={newCatName} onChange={e => setNewCatName(e.target.value)} className="luxury-input" style={{ borderRadius: '8px' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Description</label>
                <input type="text" placeholder="Outstanding technical craft & beat composition..." value={newCatDesc} onChange={e => setNewCatDesc(e.target.value)} className="luxury-input" style={{ borderRadius: '8px' }} />
              </div>

              <div>
                <button type="submit" className="luxury-btn" style={{ width: '100%', height: '43px', borderRadius: '8px' }}>
                  Create Category
                </button>
              </div>
            </form>
          </div>

          {/* Categories List */}
          <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Categories Directory</h3>
            
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Category ID</th>
                  <th>Category Title</th>
                  <th>Description</th>
                  <th>Nominees Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No categories registered in database.
                    </td>
                  </tr>
                ) : (
                  categories.map(c => {
                    const nomineesCount = nominees.filter(nom => nom.category_id === c.id).length;
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{c.id}</td>
                        <td style={{ fontWeight: 500 }}>{c.name}</td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</td>
                        <td style={{ fontWeight: 700 }}>{nomineesCount}</td>
                        <td>
                          <button 
                            onClick={() => handleDeleteCategory(c.id)}
                            disabled={nomineesCount > 0}
                            style={{ background: 'none', border: 'none', color: nomineesCount > 0 ? '#bdc3c7' : '#e74c3c', textDecoration: nomineesCount > 0 ? 'none' : 'underline', fontSize: '0.75rem', cursor: nomineesCount > 0 ? 'not-allowed' : 'pointer', fontWeight: 500 }}
                            title={nomineesCount > 0 ? 'Cannot delete category containing active nominees' : ''}
                          >
                            Delete Category
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. REGISTRATIONS / APPLICATIONS QUEUE */}
      {activeSubTab === 'registrations' && (
        <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem', overflowX: 'auto' }}>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', letterSpacing: '0.05em' }}>Nominee Onboarding Queue</h3>
          
          <table className="luxury-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Contact</th>
                <th>Category Requested</th>
                <th>Bio Summary</th>
                <th>Form Payment</th>
                <th>Onboarding Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {registrations.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No nominee applications received.
                  </td>
                </tr>
              ) : (
                registrations.map(reg => (
                  <tr key={reg.id}>
                    <td>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <img 
                          src={reg.photo_url} 
                          alt={reg.name} 
                          style={{ width: '40px', height: '48px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                        />
                        <span style={{ fontWeight: 600 }}>{reg.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.75rem' }}>
                      <p>{reg.email}</p>
                      <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{reg.phone}</p>
                    </td>
                    <td style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                      {reg.category_name ? (
                        <span style={{ color: 'var(--text-primary)' }}>{reg.category_name}</span>
                      ) : (
                        <span style={{ color: 'var(--accent-dark)', background: 'var(--accent-light)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>
                          Custom: {reg.custom_category}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={reg.bio}>
                      {reg.bio || 'N/A'}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.5rem',
                        borderRadius: '12px',
                        background: reg.payment_status === 'completed' ? '#e2f9eb' : 'var(--accent-light)',
                        color: reg.payment_status === 'completed' ? '#27ae60' : 'var(--accent-dark)'
                      }}>
                        {reg.payment_status.toUpperCase()} (GH₵ {reg.form_fee.toFixed(2)})
                      </span>
                    </td>
                    <td>
                      {reg.approval_status === 'pending' ? (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          background: 'var(--accent-light)', 
                          color: 'var(--accent-dark)',
                          border: '1px solid rgba(var(--accent-rgb), 0.2)' 
                        }}>PENDING REVIEW</span>
                      ) : reg.approval_status === 'approved' ? (
                        <div style={{ fontSize: '0.7rem' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            padding: '0.25rem 0.5rem', 
                            borderRadius: '4px',
                            background: 'rgba(46, 204, 113, 0.15)', 
                            color: '#27ae60',
                            border: '1px solid rgba(46, 204, 113, 0.3)' 
                          }}>APPROVED</span>
                          {reg.nominee_code && (
                            <p style={{ marginTop: '0.5rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                              Code: {reg.nominee_code}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          padding: '0.25rem 0.5rem', 
                          borderRadius: '4px',
                          background: 'rgba(231, 76, 60, 0.15)', 
                          color: '#c0392b',
                          border: '1px solid rgba(231, 76, 60, 0.3)' 
                        }}>REJECTED</span>
                      )}
                    </td>
                    <td>
                      {reg.approval_status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            onClick={() => handleApproveRegistration(reg.id)}
                            disabled={reg.payment_status !== 'completed'}
                            className="luxury-btn"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', background: reg.payment_status === 'completed' ? 'var(--accent)' : '#bdc3c7', cursor: reg.payment_status === 'completed' ? 'pointer' : 'not-allowed' }}
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => handleRejectRegistration(reg.id)}
                            className="luxury-btn secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.65rem', color: '#e74c3c', borderColor: '#e74c3c' }}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 5. EVENT TICKETS & SCANNER */}
      {activeSubTab === 'tickets' && (
        loadingTickets && tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '6rem 0' }}>
            <h2 className="loading-copy" style={{ fontFamily: 'var(--font-serif)', color: 'var(--text-secondary)', fontWeight: 300 }}>
              Retrieving guest registries...
            </h2>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2.5rem' }}>
          
          <style>{`
            @keyframes scanBeam {
              0% { top: 0%; }
              50% { top: 100%; }
              100% { top: 0%; }
            }
          `}</style>

          {/* Events Overview & Ticket Sales */}
          <div className="editorial-sheet" style={{ margin: 0, padding: '2rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Event Ticket Performance</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
              {eventsList.map(ev => {
                const revenue = ev.tickets_sold * ev.ticket_price;
                const checkedInCount = tickets.filter(t => t.event_id === ev.id && t.scanned === 1 && t.payment_status === 'paid').reduce((sum, t) => sum + t.quantity, 0);
                const pctSold = Math.round((ev.tickets_sold / ev.total_tickets) * 100);

                return (
                  <div key={ev.id} style={{ padding: '1.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{ev.title}</h4>
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '8px', background: ev.privacy === 'private' ? 'var(--accent-light)' : 'rgba(0,0,0,0.05)', color: ev.privacy === 'private' ? 'var(--accent-dark)' : 'inherit' }}>
                        {ev.privacy.toUpperCase()}
                      </span>
                    </div>
                    {(formatEventDate(ev) || formatEventMeta(ev)) && (
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                        {[formatEventDate(ev), formatEventMeta(ev)].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.75rem', marginBottom: '1.25rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Capacity:</span>
                        <span style={{ fontWeight: 600 }}>{ev.tickets_sold} / {ev.total_tickets} sold ({pctSold}%)</span>
                      </div>
                      
                      {/* Capacity Progress Bar */}
                      <div style={{ height: '6px', background: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--accent)', width: `${pctSold}%` }} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Checked In:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{checkedInCount} / {ev.tickets_sold} attendees</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Total Revenue:</span>
                        <span style={{ fontWeight: 700, color: 'var(--accent-dark)' }}>GH₵ {revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Interactive Check-In QR Scanner Simulator */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
            
            {/* Scanner viewfinder Frame */}
            <div className="editorial-sheet" style={{ margin: 0, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem', fontFamily: 'var(--font-serif)', alignSelf: 'flex-start' }}>Ticket Verification Console</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', alignSelf: 'flex-start' }}>Verify guest ticket codes for check-in.</p>
              
              <div style={{ 
                position: 'relative', 
                width: '100%', 
                maxWidth: '360px', 
                height: '240px', 
                background: '#090807', 
                borderRadius: '16px', 
                overflow: 'hidden', 
                border: '3px solid #1c1815',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 40px rgba(0,0,0,0.9)'
              }}>
                {/* Viewfinder frame lines */}
                <div style={{ position: 'absolute', top: '20px', left: '20px', right: '20px', bottom: '20px', border: '1px dashed rgba(255,255,255,0.25)', borderRadius: '8px', pointerEvents: 'none' }} />
                
                {/* Camera scan lines and glowing target corners */}
                <div style={{ position: 'absolute', top: '15px', left: '15px', width: '20px', height: '20px', borderTop: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)' }} />
                <div style={{ position: 'absolute', top: '15px', right: '15px', width: '20px', height: '20px', borderTop: '3px solid var(--accent)', borderRight: '3px solid var(--accent)' }} />
                <div style={{ position: 'absolute', bottom: '15px', left: '15px', width: '20px', height: '20px', borderBottom: '3px solid var(--accent)', borderLeft: '3px solid var(--accent)' }} />
                <div style={{ position: 'absolute', bottom: '15px', right: '15px', width: '20px', height: '20px', borderBottom: '3px solid var(--accent)', borderRight: '3px solid var(--accent)' }} />

                {/* Animated Scanner Laser Beam Line */}
                {!scanResult && !scanning && (
                  <div style={{ 
                    position: 'absolute', 
                    left: '20px', 
                    right: '20px', 
                    height: '2px', 
                    background: 'var(--accent)', 
                    boxShadow: '0 0 8px 1px var(--accent)', 
                    animation: 'scanBeam 3s infinite linear' 
                  }} />
                )}

                {/* Status indicator in background */}
                <div style={{ color: 'rgba(255,255,255,0.1)', fontFamily: 'monospace', fontSize: '0.8rem', letterSpacing: '0.1em', textAlign: 'center', pointerEvents: 'none' }}>
                  [ CAMERA FEED ACTIVE ]<br />
                  PLACE TICKET BARCODE IN FRAME
                </div>

                {/* Scanning Spinner overlay */}
                {scanning && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <svg className="animate-spin" style={{ width: '32px', height: '32px', color: 'var(--accent)' }} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }}></circle>
                      <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>DECODING QR DATA...</span>
                  </div>
                )}

                {/* Scan Results overlays */}
                {scanResult && (
                  <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: scanResult.success ? 'rgba(39, 174, 96, 0.95)' : 'rgba(192, 57, 43, 0.95)', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    color: '#fff', 
                    padding: '1.5rem', 
                    textAlign: 'center', 
                    zIndex: 10,
                    animation: 'fadeIn 0.25s ease'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem', lineHeight: 1 }}>{scanResult.success ? '✓' : '✕'}</div>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                      {scanResult.success ? 'Access Granted' : 'Access Denied'}
                    </h4>
                    <p style={{ fontSize: '0.75rem', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                      {scanResult.success ? (
                        <span>
                          <strong>{scanResult.ticket?.buyer_name}</strong> checked in successfully!<br />
                          {scanResult.ticket?.event_title} ({scanResult.ticket?.quantity} ticket(s))
                        </span>
                      ) : (
                        <span>{scanResult.error}</span>
                      )}
                    </p>
                    <button 
                      onClick={() => setScanResult(null)} 
                      style={{ padding: '0.4rem 1.2rem', fontSize: '0.65rem', background: '#fff', color: '#000', border: 'none', fontWeight: 700, cursor: 'pointer', borderRadius: '4px' }}
                    >
                      {scanResult.success ? 'SCAN NEXT' : 'TRY AGAIN'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Scanner Controller Fields */}
            <div className="editorial-sheet" style={{ margin: 0, padding: '2rem' }}>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Console Controls</h3>
              
              {/* Dev Test helper dropdown */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  SELECT ACTIVE PASS TO SIMULATE CHECK-IN
                </label>
                <select 
                  value={selectedTestTicket}
                  onChange={(e) => {
                    setSelectedTestTicket(e.target.value);
                    setScanCode(e.target.value);
                  }}
                  className="luxury-select"
                  style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.75rem' }}
                >
                  <option value="">-- Choose Active Pass --</option>
                  {tickets.filter(t => t.payment_status === 'paid' && t.scanned === 0).map(t => (
                    <option key={t.id} value={t.ticket_code}>
                      {t.ticket_code} - {t.buyer_name} ({t.event_title})
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'block' }}>
                  Select an active pass to pre-fill the check-in verification code.
                </span>
              </div>

              {/* Manual Input field */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Manual Alphanumeric Code Input
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. TIX-A7E9F8" 
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  className="luxury-input"
                  style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
                />
              </div>

              {scanError && (
                <div style={{ 
                  background: 'var(--accent-light)', 
                  borderLeft: '3px solid var(--accent)', 
                  padding: '0.75rem 1rem', 
                  fontSize: '0.8rem', 
                  color: 'var(--accent-dark)', 
                  marginBottom: '1rem', 
                  fontWeight: 500 
                }}>
                  {scanError}
                </div>
              )}

              <button 
                onClick={() => handleScanTicket()}
                disabled={scanning || !scanCode}
                className="luxury-btn"
                style={{ width: '100%', padding: '0.9rem', fontSize: '0.75rem', letterSpacing: '0.08em' }}
              >
                {scanning ? 'TRANSMITTING SCAN DATA...' : 'VERIFY & CHECK IN GUEST'}
              </button>
            </div>
          </div>

          {/* Attendees check-in list logs */}
          <div className="editorial-sheet" style={{ margin: 0, padding: '2rem', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Gate Check-In Logs & Guests List</h3>
            
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Ticket Code</th>
                  <th>Event Name</th>
                  <th>Guest Name</th>
                  <th>Contact Info</th>
                  <th>Quantity</th>
                  <th>Status</th>
                  <th>Checked In Status</th>
                  <th>Scan Time</th>
                </tr>
              </thead>
              <tbody>
                {tickets.length === 0 ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                      No tickets sold or logged.
                    </td>
                  </tr>
                ) : (
                  tickets.map(t => (
                    <tr key={t.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent-dark)' }}>{t.ticket_code}</td>
                      <td style={{ fontSize: '0.75rem', fontWeight: 600 }}>{t.event_title}</td>
                      <td style={{ fontWeight: 600 }}>{t.buyer_name}</td>
                      <td style={{ fontSize: '0.75rem' }}>
                        <p>{t.buyer_email}</p>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.1rem' }}>{t.buyer_phone}</p>
                      </td>
                      <td style={{ fontWeight: 700, textAlign: 'center' }}>{t.quantity}</td>
                      <td>
                        <span style={{
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '8px',
                          background: t.payment_status === 'paid' ? '#e2f9eb' : 'var(--accent-light)',
                          color: t.payment_status === 'paid' ? '#27ae60' : 'var(--accent-dark)'
                        }}>
                          {t.payment_status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          color: t.scanned === 1 ? '#27ae60' : 'var(--accent-dark)'
                        }}>
                          {t.scanned === 1 ? '✓ CHECKED IN' : '⌛ PENDING GATE'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {t.scanned === 1 ? new Date(t.scanned_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* 6. EVENT MANAGEMENT */}
      {activeSubTab === 'events' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
          {/* Create/Edit Event Form */}
          <div className="editorial-sheet" style={{ margin: 0, padding: '2.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>
              {editingEventId ? 'Edit Event Details' : 'Create New Event'}
            </h3>
            
            {eventError && (
              <div style={{ background: 'var(--accent-light)', borderLeft: '3px solid var(--accent)', padding: '0.75rem 1rem', fontSize: '0.8rem', color: 'var(--accent-dark)', marginBottom: '1.5rem', fontWeight: 500 }}>
                {eventError}
              </div>
            )}
            
            {eventSuccess && (
              <div style={{ background: 'rgba(39, 174, 96, 0.1)', borderLeft: '3px solid #27ae60', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#27ae60', marginBottom: '1.5rem', fontWeight: 500 }}>
                {eventSuccess}
              </div>
            )}

            <form onSubmit={async (e) => {
              e.preventDefault();
              setEventError('');
              setEventSuccess('');
              const payload = {
                title: eventTitle,
                description: eventDesc,
                date: eventDate,
                venue: eventVenue,
                ticket_price: parseFloat(eventPrice),
                privacy: eventPrivacy,
                access_code: eventAccessCode,
                total_tickets: parseInt(eventCapacity, 10)
              };

              try {
                const url = editingEventId 
                  ? `${API_BASE_URL}/api/admin/events/${editingEventId}`
                  : `${API_BASE_URL}/api/admin/events`;
                const method = editingEventId ? 'PUT' : 'POST';

                const res = await fetch(url, {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify(payload)
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Failed to save event');

                setEventSuccess(data.message || 'Event saved successfully!');
                setEditingEventId(null);
                setEventTitle('');
                setEventDesc('');
                setEventDate('');
                setEventVenue('');
                setEventPrice(0);
                setEventPrivacy('public');
                setEventAccessCode('');
                setEventCapacity(100);
                fetchTicketsData(); // refresh list
              } catch (err) {
                setEventError(err.message);
              }
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Event Title *</label>
                  <input type="text" required value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} className="luxury-input" placeholder="e.g. Gala Night" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Event Date</label>
                  <input type="text" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="luxury-input" placeholder="e.g. 2026" />
                </div>
                {BRANDING.showVenue && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Venue Location</label>
                    <input type="text" value={eventVenue} onChange={(e) => setEventVenue(e.target.value)} className="luxury-input" placeholder="e.g. Main Auditorium" />
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Ticket Price (GH₵) *</label>
                  <input type="number" step="0.01" required value={eventPrice} onChange={(e) => setEventPrice(e.target.value)} className="luxury-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Total Capacity *</label>
                  <input type="number" required value={eventCapacity} onChange={(e) => setEventCapacity(e.target.value)} className="luxury-input" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Privacy *</label>
                  <select value={eventPrivacy} onChange={(e) => setEventPrivacy(e.target.value)} className="luxury-select" style={{ width: '100%', padding: '0.6rem 0.75rem', fontSize: '0.75rem' }}>
                    <option value="public">Public</option>
                    <option value="private">Private (Requires Access Code)</option>
                  </select>
                </div>
                {eventPrivacy === 'private' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Access Code *</label>
                    <input type="text" required value={eventAccessCode} onChange={(e) => setEventAccessCode(e.target.value)} className="luxury-input" placeholder="e.g. VIP2026" />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Event Description</label>
                <textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} className="luxury-input" style={{ minHeight: '60px', padding: '0.6rem 0.75rem', fontSize: '0.75rem' }} placeholder="Optional short summary..." />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="submit" className="luxury-btn" style={{ padding: '0.6rem 2rem', fontSize: '0.75rem' }}>
                  {editingEventId ? 'UPDATE EVENT' : 'CREATE EVENT'}
                </button>
                {editingEventId && (
                  <button type="button" onClick={() => {
                    setEditingEventId(null);
                    setEventTitle('');
                    setEventDesc('');
                    setEventDate('');
                    setEventVenue('');
                    setEventPrice(0);
                    setEventPrivacy('public');
                    setEventAccessCode('');
                    setEventCapacity(100);
                  }} className="luxury-btn secondary" style={{ padding: '0.6rem 2rem', fontSize: '0.75rem' }}>
                    CANCEL
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Events List table */}
          <div className="editorial-sheet" style={{ margin: 0, padding: '2rem', overflowX: 'auto' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>Active Event Catalog</h3>
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Title</th>
                  {BRANDING.showVenue && <th>Venue</th>}
                  <th>Date</th>
                  <th>Ticket Price</th>
                  <th>Capacity</th>
                  <th>Sold</th>
                  <th>Privacy</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {eventsList.length === 0 ? (
                  <tr>
                    <td colSpan={BRANDING.showVenue ? 9 : 8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No events configured.</td>
                  </tr>
                ) : (
                  eventsList.map(ev => (
                    <tr key={ev.id}>
                      <td style={{ fontWeight: 700 }}>{ev.id}</td>
                      <td style={{ fontWeight: 600 }}>{ev.title}</td>
                      {BRANDING.showVenue && <td>{ev.venue || '—'}</td>}
                      <td>{formatEventDate(ev) || '—'}</td>
                      <td style={{ fontWeight: 700 }}>GH₵ {ev.ticket_price.toFixed(2)}</td>
                      <td>{ev.total_tickets}</td>
                      <td style={{ fontWeight: 600, color: 'var(--accent-dark)' }}>{ev.tickets_sold}</td>
                      <td>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.4rem', borderRadius: '4px', background: ev.privacy === 'private' ? 'var(--accent-light)' : 'rgba(0,0,0,0.05)', color: ev.privacy === 'private' ? 'var(--accent-dark)' : 'inherit' }}>
                          {ev.privacy.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button onClick={() => {
                            setEditingEventId(ev.id);
                            setEventTitle(ev.title);
                            setEventDesc(ev.description || '');
                            setEventDate(ev.date || '');
                            setEventVenue(ev.venue || '');
                            setEventPrice(ev.ticket_price);
                            setEventPrivacy(ev.privacy);
                            setEventAccessCode(ev.access_code || '');
                            setEventCapacity(ev.total_tickets);
                          }} className="luxury-btn text-link" style={{ fontSize: '0.7rem' }}>[ Edit ]</button>
                          
                          <button onClick={async () => {
                            setConfirmDialog({
                              message: `Delete "${ev.title}"? All ticket records for this event will be removed. Linked nominees will stay in the system but will no longer be tied to this event.`,
                              onConfirm: async () => {
                                try {
                                  const res = await fetch(`${API_BASE_URL}/api/admin/events/${ev.id}`, {
                                    method: 'DELETE',
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  const data = await res.json();
                                  if (!res.ok) throw new Error(data.error || 'Failed to delete event');
                                  setAlertDialog({ title: 'Event deleted', message: data.message || 'Event removed.' });
                                  fetchTicketsData();
                                } catch (err) {
                                  setAlertDialog({ title: 'Error', message: err.message });
                                }
                              }
                            });
                          }} className="luxury-btn text-link" style={{ fontSize: '0.7rem', color: '#e74c3c' }}>[ Delete ]</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. SYSTEM AUDIT LOGS */}
      {activeSubTab === 'audit' && (
        <div className="editorial-sheet" style={{ margin: 0, padding: '2rem' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', fontFamily: 'var(--font-serif)', fontWeight: 400 }}>System Administrative Audit Trail</h3>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            A verified chronological log of write transactions and staff actions on the VoteEQ database.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="luxury-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Admin User</th>
                  <th>Action</th>
                  <th>Description & Parameters</th>
                </tr>
              </thead>
              <tbody>
                {loadingAudit && auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>Loading audit trail logs...</td>
                  </tr>
                ) : auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>No audit logs recorded yet.</td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.admin_username}</td>
                      <td>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--accent-light)', color: 'var(--accent-dark)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-primary)' }}>{log.details}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="luxury-modal-overlay" style={{ zIndex: 1500 }}>
          <div className="luxury-modal" style={{ maxWidth: '400px', padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '1rem' }}>Are you sure?</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5' }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  confirmDialog.onConfirm();
                  setConfirmDialog(null);
                }}
                className="luxury-btn"
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.75rem' }}
              >
                CONFIRM
              </button>
              <button 
                onClick={() => setConfirmDialog(null)}
                className="luxury-btn secondary"
                style={{ flex: 1, padding: '0.6rem', fontSize: '0.75rem' }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {alertDialog && (
        <div className="luxury-modal-overlay" style={{ zIndex: 1500 }}>
          <div className="luxury-modal" style={{ maxWidth: '420px', padding: '2rem', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: '1rem' }}>
              {alertDialog.title}
            </h3>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.5', textAlign: 'left' }}>
              {alertDialog.message}
            </div>
            <button 
              onClick={() => setAlertDialog(null)}
              className="luxury-btn"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.75rem' }}
            >
              DISMISS
            </button>
          </div>
        </div>
      )}
      
      </div>
    );
  }
