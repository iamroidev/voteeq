import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function AdminDashboard({ token, onLogout, categories, nominees, refreshData }) {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  
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

  // Active sub-view tab: 'overview', 'nominees', 'categories'
  const [activeSubTab, setActiveSubTab] = useState('overview');

  const fetchStats = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/overview`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load admin stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [nominees, categories]);

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

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/categories/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete category');
      refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateNominee = async (e) => {
    e.preventDefault();
    setNomError('');
    setNomSuccess('');
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
          category_id: parseInt(newNomCategoryId)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add nominee');
      
      setNomSuccess(data.message);
      setNewNomCode('');
      setNewNomName('');
      setNewNomPhoto('');
      setNewNomCategoryId('');
      refreshData();
    } catch (err) {
      setNomError(err.message);
    }
  };

  const handleDeleteNominee = async (id) => {
    if (!window.confirm('Are you sure you want to delete this nominee? All their votes will also be deleted.')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/nominees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete nominee');
      refreshData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="admin-dashboard-container" style={{ animation: 'fadeIn 0.6s ease' }}>
      {/* Header Panel */}
      <div className="dashboard-header-card" style={{ marginBottom: '3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', padding: '2rem', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '24px' }}>
        <div>
          <span className="ref-badge" style={{ marginBottom: '0.5rem', background: 'var(--text-primary)', color: '#fff', borderColor: 'var(--text-primary)' }}>
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
      </div>

      {/* 1. OVERVIEW */}
      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
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
                    <div style={{ height: '100%', background: 'var(--accent)', width: `${stats?.totalVotes ? ((stats.channelStats?.web || 0) / stats.totalVotes) * 100 : 0}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>USSD Dialer</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{stats?.channelStats?.ussd || 0} votes ({((stats?.channelStats?.ussd || 0) * 0.50).toFixed(2)} GHS)</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--accent-dark)', width: `${stats?.totalVotes ? ((stats.channelStats?.ussd || 0) / stats.totalVotes) * 100 : 0}%`, transition: 'width 1s ease' }} />
                  </div>
                </div>
              </div>
            </div>

            <div className="editorial-sheet" style={{ margin: 0, borderRadius: '16px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Database Status</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>SQLite connection status</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', border: '1px solid var(--border-color)', padding: '1rem', borderRadius: '12px' }}>
                <span className="pulse-indicator" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#2ecc71', boxShadow: '0 0 8px #2ecc71' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#27ae60', display: 'block' }}>Connected</span>
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
            {nomSuccess && <div style={{ background: '#e2f9eb', borderLeft: '3px solid #2ecc71', padding: '0.75rem 1rem', fontSize: '0.8rem', color: '#27ae60', marginBottom: '1.5rem', fontWeight: 500 }}>{nomSuccess}</div>}

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
                        {n.passcode === 'PENDING' ? (
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
    </div>
  );
}
