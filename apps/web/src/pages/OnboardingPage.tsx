import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '@mile-triage/shared';
import { api } from '../api';

export function OnboardingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      setVehicles(await api.vehicles());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load vehicles');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const sync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const result = await api.syncVehicles();
      setVehicles(result.vehicles);
      setMessage(result.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const enable = async (id: string) => {
    await api.trackVehicle(id, true);
    try {
      const pairing = await api.pairing(id);
      setPairingUrl(pairing.pairingUrl);
      setNote(pairing.note ?? null);
    } catch {
      setPairingUrl(null);
      setNote('Enable tracking saved. Pairing link needs TESLA_DOMAIN in live mode.');
    }
    await load();
  };

  const markPaired = async (id: string) => {
    await api.markPaired(id);
    await load();
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Choose vehicles
        </h1>
        <p className="muted">
          Sync from Tesla (live mode), enable tracking, then pair the virtual
          key.
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      {message && <p className="muted">{message}</p>}
      <div className="actions">
        <button
          className="btn secondary"
          disabled={syncing}
          onClick={() => void sync()}
        >
          {syncing ? 'Syncing…' : 'Sync from Tesla'}
        </button>
        <Link className="btn ghost" to="/setup">
          Tesla setup checklist
        </Link>
      </div>
      <div className="card-list">
        {vehicles.map((v) => (
          <div className="vehicle-card" key={v.id}>
            <div>
              <strong>{v.displayName ?? v.vin}</strong>
              <div className="muted">{v.vin}</div>
              <div className="muted">
                {v.trackingEnabled ? 'Tracking on' : 'Not tracking'}
                {v.virtualKeyPaired ? ' · key paired' : ' · key not paired'}
                {v.telemetryConfigured ? ' · telemetry ready' : ''}
              </div>
            </div>
            <div className="actions">
              <button className="btn" onClick={() => void enable(v.id)}>
                {v.trackingEnabled ? 'Enabled' : 'Track'}
              </button>
              {v.trackingEnabled && !v.virtualKeyPaired && (
                <button
                  className="btn secondary"
                  onClick={() => void markPaired(v.id)}
                >
                  Mark paired
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      {pairingUrl && (
        <div className="stat">
          <span className="muted">Virtual key pairing</span>
          <p>
            Open this link on a phone with the Tesla app:{' '}
            <a href={pairingUrl} target="_blank" rel="noreferrer">
              {pairingUrl}
            </a>
          </p>
          {note && <p className="muted">{note}</p>}
        </div>
      )}
      <div className="actions">
        <Link className="btn" to="/triage">
          Go to weekly triage
        </Link>
      </div>
    </div>
  );
}
