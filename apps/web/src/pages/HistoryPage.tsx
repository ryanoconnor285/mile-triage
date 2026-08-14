import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, DriveSummary } from '@mile-triage/shared';
import { api } from '../api';
import {
  formatDriveEnd,
  formatDriveStart,
  formatDriveWhen,
} from '../drive-labels';

export function HistoryPage() {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'ALL' | string>('ALL');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [business, personal, cats] = await Promise.all([
        api.drives({ status: 'BUSINESS' }),
        api.drives({ status: 'PERSONAL' }),
        api.categories(),
      ]);
      const merged = [...business, ...personal].sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
      setDrives(merged);
      setCategories(cats);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    if (filter === 'ALL') return drives;
    return drives.filter((d) => d.categoryId === filter);
  }, [drives, filter]);

  const reclassify = async (id: string, categoryId: string | null) => {
    await api.updateDrive(id, { categoryId });
    await load();
  };

  return (
    <div className="page drive-workspace">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>History</h2>
            <div className="muted">{visible.length} classified drives</div>
          </div>
          <div className="actions">
            <button
              className={`btn ghost ${filter === 'ALL' ? 'active-filter' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                className={`btn ghost ${filter === c.id ? 'active-filter' : ''}`}
                onClick={() => setFilter(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div className="drive-table-wrap">
          {error && (
            <p className="table-message" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          {!visible.length && (
            <p className="table-message muted">
              No classified drives yet — triage first.
            </p>
          )}
          {visible.length > 0 && (
            <table className="drive-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Category</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="col-num">Mi</th>
                  <th>Vehicle</th>
                  <th>Purpose</th>
                  <th>Notes</th>
                  <th>Reclassify</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id}>
                    <td className="col-when">{formatDriveWhen(d.startedAt)}</td>
                    <td>
                      <span
                        className={`status-pill ${d.categoryDeductible ? 'biz' : 'per'}`}
                      >
                        {d.categoryName ?? '—'}
                      </span>
                    </td>
                    <td className="col-place" title={formatDriveStart(d)}>
                      {formatDriveStart(d)}
                    </td>
                    <td className="col-place" title={formatDriveEnd(d)}>
                      {formatDriveEnd(d)}
                    </td>
                    <td className="col-num">
                      {d.distanceMiles?.toFixed(1) ?? '—'}
                    </td>
                    <td className="col-vehicle">{d.vehicleName ?? '—'}</td>
                    <td className="col-text">{d.purposeNote ?? '—'}</td>
                    <td className="col-text">{d.notes ?? '—'}</td>
                    <td>
                      <select
                        className="table-select"
                        value={d.categoryId ?? ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          void reclassify(d.id, value || null);
                        }}
                      >
                        <option value="">Unclassify</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
