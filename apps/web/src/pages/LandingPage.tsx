import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';

export function LandingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'mock' | 'tesla' | null>(null);
  const [busy, setBusy] = useState(false);
  const signupBlocked = searchParams.get('signup') === 'blocked';

  useEffect(() => {
    void api
      .authMode()
      .then((r) => setMode(r.mode === 'tesla' ? 'tesla' : 'mock'))
      .catch(() => setMode('mock'));
  }, []);

  const continueDemo = async () => {
    setBusy(true);
    try {
      await api.mockLogin();
      navigate('/triage');
    } catch {
      window.alert(
        'Demo login failed. Check that web can reach the API (/api/health).',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="hero">
      <div className="hero-inner">
        <div className="brand brand-lg" style={{ marginBottom: '1.25rem' }}>
          <img className="brand-mark" src="/favicon.svg" alt="" />
          MileTriage
        </div>
        <h1>Weekly miles. Thirty seconds.</h1>
        <p>
          Pull Tesla telematics automatically, then classify business vs personal
          drives from your phone — no phone GPS drain, no forgotten trips.
        </p>
        {signupBlocked && (
          <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>
            MileTriage is in private beta. Sign-up is limited to invited accounts.
          </p>
        )}
        <div className="actions">
          {mode === 'mock' && (
            <button
              className="btn"
              type="button"
              disabled={busy}
              onClick={() => void continueDemo()}
            >
              {busy ? 'Signing in…' : 'Continue with demo'}
            </button>
          )}
          {mode === 'tesla' ? (
            <a className="btn" href="/api/auth/tesla">
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
        {mode === 'tesla' && (
          <p className="muted" style={{ marginTop: '1rem' }}>
            Private beta — connect with an invited Tesla account.
          </p>
        )}
      </div>
    </div>
  );
}
