import { useEffect, useState } from 'react';
import { api, type SetupStatus } from '../api';

export function SetupPage() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .setupStatus()
      .then(setStatus)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Failed to load setup status'),
      );
  }, []);

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Tesla setup
        </h1>
        <p className="muted">
          Checklist for going live with Fleet API. Demo mode works without this.
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {status && (
        <>
          <div className="stats">
            <div className="stat">
              <span className="muted">Auth mode</span>
              <strong>{status.authMode}</strong>
            </div>
            <div className="stat">
              <span className="muted">Ready for OAuth</span>
              <strong>{status.readyForTeslaOauth ? 'Yes' : 'Not yet'}</strong>
            </div>
          </div>
          <div className="card-list">
            {status.checks.map((c) => (
              <div className="vehicle-card" key={c.id}>
                <div>
                  <strong>
                    {c.ok ? '✓' : '○'} {c.label}
                  </strong>
                  <div className="muted">{c.detail}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="stat">
            <span className="muted">Public key URL (must be on your domain)</span>
            <p>
              <code>{status.publicKeyUrl}</code>
            </p>
            {status.pairingUrl && (
              <>
                <span className="muted">Virtual key pairing</span>
                <p>
                  <code>{status.pairingUrl}</code>
                </p>
              </>
            )}
            <p className="muted">
              Generate keys with <code>npm run tesla:keys</code>, host the
              public key, register the app at developer.tesla.com, then set{' '}
              <code>AUTH_MODE=tesla</code>.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
