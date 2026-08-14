import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, DriveDetail, DriveSummary } from '@mile-triage/shared';
import { api } from '../api';
import { formatDriveRoute } from '../drive-labels';
import { DriveMap } from '../components/DriveMap';

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function HistoryPage() {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'ALL' | string>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DriveDetail | null>(null);
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
      setSelectedId((current) => {
        if (current && merged.some((d) => d.id === current)) return current;
        return merged[0]?.id ?? null;
      });
      if (!merged.length) setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    void api.drive(selectedId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visible = useMemo(() => {
    if (filter === 'ALL') return drives;
    return drives.filter((d) => d.categoryId === filter);
  }, [drives, filter]);

  const reclassify = async (id: string, categoryId: string | null) => {
    await api.updateDrive(id, { categoryId });
    await load();
  };

  return (
    <div className="page">
      <div className="triage">
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
          <div className="drive-list">
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            {!visible.length && (
              <p className="muted">No classified drives yet — triage first.</p>
            )}
            {visible.map((d) => (
              <div
                key={d.id}
                className={`drive-row ${selectedId === d.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(d.id)}
              >
                <div
                  className={`status-pill ${d.categoryDeductible ? 'biz' : 'per'}`}
                >
                  {(d.categoryName ?? '?').slice(0, 4)}
                </div>
                <div className="drive-meta">
                  <strong>{formatDriveRoute(d)}</strong>
                  <span>{formatWhen(d.startedAt)}</span>
                  {d.purposeNote && <span>Purpose: {d.purposeNote}</span>}
                  {d.notes && <span>Notes: {d.notes}</span>}
                  <div className="actions" style={{ marginTop: '0.4rem' }}>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        className={`btn ${c.deductible ? 'business' : 'personal'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          void reclassify(d.id, c.id);
                        }}
                      >
                        {c.name}
                      </button>
                    ))}
                    <button
                      className="btn ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        void reclassify(d.id, null);
                      }}
                    >
                      Unclassify
                    </button>
                  </div>
                </div>
                <div className="miles">
                  {d.distanceMiles?.toFixed(1) ?? '—'} mi
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Route</h2>
          </div>
          <DriveMap drive={detail} />
        </section>
      </div>
    </div>
  );
}
