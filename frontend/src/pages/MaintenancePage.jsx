import { BRANDING } from '../branding';

export default function MaintenancePage({ onAdminLogin }) {
  const message =
    BRANDING.maintenanceMessage ||
    'We are currently performing scheduled maintenance. Please check back soon.';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem 1.5rem 4rem',
        position: 'relative',
      }}
    >
      <div className="ambient-glow-1" />
      <div className="ambient-glow-2" />

      <div
        className="editorial-sheet"
        style={{
          maxWidth: '520px',
          width: '100%',
          padding: '4rem 2.5rem',
          textAlign: 'center',
        }}
      >
        <span className="ref-badge" style={{ marginBottom: '1.5rem', display: 'inline-block' }}>
          Maintenance
        </span>

        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(184, 152, 108, 0.08)',
            border: '1px solid var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem auto',
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '2rem',
            marginBottom: '1rem',
            lineHeight: 1.2,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          Site Under Maintenance
        </h1>

        <p
          style={{
            fontSize: '0.95rem',
            color: 'var(--text-secondary)',
            marginBottom: '2rem',
            lineHeight: 1.8,
          }}
        >
          {message}
        </p>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '0.5rem 1rem',
            background: 'rgba(184, 152, 108, 0.06)',
            border: '1px dashed rgba(184, 152, 108, 0.3)',
            borderRadius: '4px',
            fontSize: '0.78rem',
            color: 'var(--accent)',
            letterSpacing: '0.06em',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              marginRight: '0.5rem',
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent)',
            }}
          />
          {BRANDING.platformName.toUpperCase()} · {BRANDING.organizerName}
        </div>
      </div>

      <p
        style={{
          marginTop: '2.5rem',
          fontSize: '0.65rem',
          color: 'var(--text-secondary)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        &copy; {new Date().getFullYear()} {BRANDING.platformName}
        {onAdminLogin && (
          <>
            {' · '}
            <button
              type="button"
              onClick={onAdminLogin}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: 'inherit',
                letterSpacing: 'inherit',
                textTransform: 'inherit',
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
              }}
            >
              Admin
            </button>
          </>
        )}
      </p>
    </div>
  );
}
