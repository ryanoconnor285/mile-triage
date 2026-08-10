import { useEffect, useState } from 'react';
import type { ReportSummary } from '@mile-triage/shared';
import { api } from '../api';

function toInputDate(iso: string) {
  return iso.slice(0, 10);
}

function fromInputDate(value: string, endOfDay = false) {
  if (endOfDay) return new Date(`${value}T23:59:59.999`).toISOString();
  return new Date(`${value}T00:00:00.000`).toISOString();
}

export function ReportsPage() {
  const [fromDate, setFromDate] = useState(() =>
    toInputDate(new Date(new Date().getFullYear(), 0, 1).toISOString()),
  );
  const [toDate, setToDate] = useState(() =>
    toInputDate(new Date().toISOString()),
  );
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [rate, setRate] = useState(0.7);
  const [error, setError] = useState<string | null>(null);

  const range = {
    from: fromInputDate(fromDate),
    to: fromInputDate(toDate, true),
  };

  const refresh = async () => {
    try {
      const [settings, report] = await Promise.all([
        api.settings(),
        api.reportSummary(range.from, range.to),
      ]);
      setRate(settings.mileageRate);
      setSummary(report);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load report');
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const saveRate = async () => {
    await api.updateSettings({ mileageRate: rate });
    await refresh();
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Reports
        </h1>
        <p className="muted">Totals and export for your records.</p>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="vehicle-card">
        <label>
          <div className="muted">From</div>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="purpose-input"
            style={{ marginTop: '0.35rem', width: 180 }}
          />
        </label>
        <label>
          <div className="muted">To</div>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="purpose-input"
            style={{ marginTop: '0.35rem', width: 180 }}
          />
        </label>
      </div>
      {summary && (
        <div className="stats">
          <div className="stat">
            <span className="muted">Business miles</span>
            <strong>{summary.businessMiles}</strong>
          </div>
          <div className="stat">
            <span className="muted">Deduction</span>
            <strong>${summary.deductionDollars.toFixed(2)}</strong>
          </div>
          <div className="stat">
            <span className="muted">Personal miles</span>
            <strong>{summary.personalMiles}</strong>
          </div>
          <div className="stat">
            <span className="muted">Unclassified</span>
            <strong>{summary.unclassifiedMiles}</strong>
          </div>
        </div>
      )}
      <div className="vehicle-card">
        <label>
          <div className="muted">Mileage rate ($/mi)</div>
          <input
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            style={{
              marginTop: '0.35rem',
              background: 'var(--bg)',
              color: 'var(--text)',
              border: '1px solid var(--line)',
              borderRadius: 8,
              padding: '0.5rem 0.75rem',
              width: 140,
            }}
          />
        </label>
        <button className="btn secondary" onClick={() => void saveRate()}>
          Save rate
        </button>
      </div>
      <div className="actions">
        <a
          className="btn"
          href={`/api/exports/csv?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
        >
          Download CSV
        </a>
        <a
          className="btn secondary"
          href={`/api/exports/pdf?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}
        >
          Download PDF
        </a>
      </div>
    </div>
  );
}
