import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Vehicle } from '@mile-triage/shared';
import { api } from '../api';

export function OnboardingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
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

  const setTracking = async (id: string, enabled: boolean) => {
    setError(null);
    try {
      await api.trackVehicle(id, enabled);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update tracking');
    }
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Choose vehicles
        </h1>
        <p className="muted">
          Sync from Tesla and turn on tracking. MileTriage then logs a drive
          whenever the car parks somewhere new.
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
      </div>
      <div className="vehicle-grid">
        {vehicles.map((v) => (
          <div className="vehicle-tile" key={v.id}>
            <div className="vehicle-tile-head">
              <strong>{v.displayName ?? v.vin}</strong>
              <span className="vin">{v.vin}</span>
            </div>
            <div className="chips">
              <span className={`chip ${v.trackingEnabled ? 'on' : ''}`}>
                {v.trackingEnabled ? 'Tracking on' : 'Not tracking'}
              </span>
            </div>
            <div className="vehicle-tile-actions">
              <button
                className={`btn ${v.trackingEnabled ? 'ghost' : ''}`}
                onClick={() => void setTracking(v.id, !v.trackingEnabled)}
              >
                {v.trackingEnabled ? 'Stop tracking' : 'Track this car'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div className="access">
        <h2 className="section-title">What MileTriage can see</h2>
        <div className="access-cols">
          <div>
            <span className="muted">Reads from your Tesla account</span>
            <ul>
              <li>Which cars are on the account, with names and VINs</li>
              <li>Odometer readings, to work out how far a trip was</li>
              <li>
                Location at the start and end of a trip, for the map and
                addresses
              </li>
            </ul>
          </div>
          <div>
            <span className="muted">Never does</span>
            <ul>
              <li>
                Send a command to your car. Unlocking, starting, and remote
                control need Tesla&apos;s Vehicle Commands permission, which
                this app does not ask for.
              </li>
              <li>
                Wake your car. Readings are only taken when it is already awake,
                so tracking costs no battery.
              </li>
              <li>
                Touch your charging. If you allowed charging access when you
                signed in, MileTriage does not use it.
              </li>
              <li>Share your drives or locations with anyone else.</li>
            </ul>
          </div>
        </div>
        <p className="muted">
          You can review or withdraw any of this from{' '}
          <a
            className="link"
            href="https://www.tesla.com/teslaaccount/account-settings/security"
            target="_blank"
            rel="noreferrer"
          >
            Tesla account settings
          </a>
          . Revoking access stops new drives from arriving; the ones already
          recorded stay here.
        </p>
      </div>
      <div className="actions">
        <Link className="btn" to="/triage">
          Go to weekly triage
        </Link>
      </div>
    </div>
  );
}
