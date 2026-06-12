import { useState } from 'react';
import { API_BASE_URL } from '../config';

export default function NomineeApplyPage({ onBack, categories, onPaymentRedirect }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // If "custom" category selected, custom category string is required
    if (categoryId === 'custom' && !customCategory.trim()) {
      setError('Please specify the custom category name.');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/nominees/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          phone,
          bio,
          photo_url: photoUrl,
          category_id: categoryId === 'custom' || !categoryId ? null : parseInt(categoryId),
          custom_category: categoryId === 'custom' ? customCategory.trim() : null
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit application');
      }

      onPaymentRedirect({
        ...data,
        amount: 10.00,
        nominee: name,
        votes: 1,
        isForm: true,
        phone: phone
      });
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to initiate checkout.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2rem 0' }}>
      <button onClick={onBack} className="luxury-btn secondary" style={{ marginBottom: '2rem', padding: '0.5rem 1.5rem', fontSize: '0.7rem' }}>
        ← Back to Portal
      </button>

      <div className="editorial-sheet" style={{ padding: '2.5rem' }}>
        <span className="ref-badge" style={{ marginBottom: '1rem', display: 'inline-block' }}>Onboarding</span>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: '1.25rem', lineHeight: 1.2 }}>
          Apply as Nominee
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
          Register your interest to join the official Voteeq Awards. The nominee onboarding form purchase fee is <strong>GH₵ 10.00</strong>. 
          Upon successful payment, your application will be submitted for committee approval. Once approved, you will receive an activation PIN.
        </p>

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

        <form onSubmit={handleApplySubmit}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Full Name / Stage Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Shatta Wale"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="luxury-input"
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Email Address *
              </label>
              <input
                type="email"
                required
                placeholder="candidate@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="luxury-input"
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Phone Number *
              </label>
              <input
                type="tel"
                required
                placeholder="e.g. 0540000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="luxury-input"
              />
            </div>
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Nominee Category *
            </label>
            <select
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="luxury-select"
              style={{ width: '100%', padding: '0.6rem 0.75rem', background: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
            >
              <option value="">Select a Category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
              <option value="custom">Suggest a Custom Category...</option>
            </select>
          </div>

          {categoryId === 'custom' && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                Custom Category Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Producer of the Year"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="luxury-input"
              />
            </div>
          )}

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Nominee Campaign Photo URL (Optional)
            </label>
            <input
              type="url"
              placeholder="e.g. https://domain.com/photo.jpg"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              className="luxury-input"
            />
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              Nominee Biography / Details
            </label>
            <textarea
              placeholder="Tell the committee and public about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="luxury-input"
              rows={4}
              style={{ width: '100%', padding: '0.6rem 0.75rem', fontFamily: 'inherit', resize: 'vertical' }}
            />
          </div>

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
                Item
              </span>
              <p style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', marginTop: '0.15rem' }}>
                Nomination Processing Form
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                Form purchase fee
              </span>
              <p style={{ fontSize: '1.3rem', fontFamily: 'var(--font-serif)', color: 'var(--accent-dark)', marginTop: '0.15rem' }}>
                GH₵ 10.00
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="luxury-btn"
            style={{ width: '100%', padding: '1.1rem', fontSize: '0.8rem', letterSpacing: '0.15em' }}
          >
            {loading ? 'PROCESSING...' : 'PROCEED TO SECURE PAYMENT (GH₵ 10.00)'}
          </button>
        </form>
      </div>
    </div>
  );
}
