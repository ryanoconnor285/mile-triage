import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import type { Vehicle } from '@mile-triage/shared';
import { api } from '../api';

export function OnboardingPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [pairingUrl, setPairingUrl] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

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
      setNote(
        'Enable tracking saved. Pairing link needs TESLA_DOMAIN in live mode.',
      );
    }
    await load();
  };

  const markPaired = async (id: string) => {
    await api.markPaired(id);
    await load();
  };

  const copyPairingUrl = async () => {
    if (!pairingUrl) return;
    try {
      await navigator.clipboard.writeText(pairingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the link and copy it manually.');
    }
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Choose vehicles
        </h1>
        <p className="muted">
          Sync from Tesla, turn on tracking, then pair the virtual key so the
          car can send drives.
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
              <span className={`chip ${v.virtualKeyPaired ? 'on' : ''}`}>
                {v.virtualKeyPaired ? 'Key paired' : 'Key not paired'}
              </span>
              {v.telemetryConfigured && (
                <span className="chip on">Telemetry ready</span>
              )}
            </div>
            <div className="vehicle-tile-actions">
              <button
                className={`btn ${v.trackingEnabled ? 'secondary' : ''}`}
                onClick={() => void enable(v.id)}
              >
                {v.trackingEnabled ? 'Tracking' : 'Track this car'}
              </button>
              {v.trackingEnabled && !v.virtualKeyPaired && (
                <button
                  className="btn ghost"
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
        <div className="pairing">
          <div className="pairing-copy">
            <h2 className="pairing-title">Pair the virtual key</h2>
            <p className="muted">
              Scan this with your phone camera, or open the link on a phone that
              has the Tesla app installed and is signed in to the same account.
            </p>
            <div className="actions">
              <a
                className="btn"
                href={pairingUrl}
                target="_blank"
                rel="noreferrer"
              >
                Open in Tesla app
              </a>
              <button
                className="btn ghost"
                onClick={() => void copyPairingUrl()}
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
            <p className="pairing-url">{pairingUrl}</p>
            {note && <p className="muted">{note}</p>}
          </div>
          <div className="qr">
            <QRCodeSVG
              value={pairingUrl}
              size={160}
              bgColor="#ffffff"
              fgColor="#0f172a"
              marginSize={2}
            />
          </div>
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
