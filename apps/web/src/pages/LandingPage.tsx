import { useEffect, useState } from 'react';
import { api } from '../api';

export function LandingPage() {
  const [mode, setMode] = useState<'mock' | 'tesla' | null>(null);

  useEffect(() => {
    void api
      .authMode()
      .then((r) => setMode(r.mode === 'tesla' ? 'tesla' : 'mock'))
      .catch(() => setMode('mock'));
  }, []);

  return (
    <div className="hero">
      <div className="hero-inner">
        <div className="brand" style={{ marginBottom: '1.25rem' }}>
          MileTriage
        </div>
        <h1>Weekly miles. Thirty seconds.</h1>
        <p>
          Pull Tesla telematics automatically, then triage business vs personal
          drives on a map — no phone GPS drain, no forgotten trips.
        </p>
        <div className="actions">
          <a className="btn" href="/api/auth/mock">
            Continue with demo
          </a>
          {mode === 'tesla' ? (
            <a className="btn secondary" href="/api/auth/tesla">
              Connect Tesla
            </a>
          ) : (
            <button
              className="btn secondary"
              type="button"
              title="Set AUTH_MODE=tesla and Tesla credentials in .env"
              disabled={mode === null}
              onClick={() => {
                window.alert(
                  'Tesla login is not configured yet.\n\nUse “Continue with demo” for now, or set AUTH_MODE=tesla plus TESLA_CLIENT_ID / TESLA_CLIENT_SECRET in .env after registering a Tesla developer app.',
                );
              }}
            >
              Connect Tesla
            </button>
          )}
        </div>
        {mode === 'mock' && (
          <p className="muted" style={{ marginTop: '1rem' }}>
            Running in demo mode — no Tesla developer app required.
          </p>
        )}
      </div>
    </div>
  );
}
