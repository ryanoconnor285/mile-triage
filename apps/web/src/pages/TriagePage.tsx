import { useEffect, useMemo, useState } from 'react';
import type { Category, DriveDetail, DriveSummary } from '@mile-triage/shared';
import { Link } from 'react-router-dom';
import { api } from '../api';
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

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

function weekLabel(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

type Draft = { purposeNote: string; notes: string };

export function TriagePage() {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DriveDetail | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Left null until known so the demo-only control never flashes for real users.
  const [authMode, setAuthMode] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [list, cats, mode] = await Promise.all([
        api.drives({ status: 'UNCLASSIFIED' }),
        api.categories(),
        api.authMode(),
      ]);
      setDrives(list);
      setCategories(cats);
      setAuthMode(mode.mode);
      setDrafts((prev) => {
        const next: Record<string, Draft> = {};
        for (const d of list) {
          next[d.id] = prev[d.id] ?? {
            purposeNote: d.purposeNote ?? '',
            notes: d.notes ?? '',
          };
        }
        return next;
      });
      setSelectedId((current) => {
        if (current && list.some((d) => d.id === current)) return current;
        return list[0]?.id ?? null;
      });
      if (!list.length) setDetail(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const totalMiles = useMemo(
    () =>
      Number(
        drives.reduce((sum, d) => sum + (d.distanceMiles ?? 0), 0).toFixed(1),
      ),
    [drives],
  );

  const weekGroups = useMemo(() => {
    const map = new Map<string, { start: Date; drives: DriveSummary[] }>();
    for (const d of drives) {
      const start = startOfWeek(new Date(d.startedAt));
      const key = start.toISOString();
      const group = map.get(key) ?? { start, drives: [] };
      group.drives.push(d);
      map.set(key, group);
    }
    return [...map.values()].sort(
      (a, b) => b.start.getTime() - a.start.getTime(),
    );
  }, [drives]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setDraft = (id: string, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        purposeNote: prev[id]?.purposeNote ?? '',
        notes: prev[id]?.notes ?? '',
        ...patch,
      },
    }));
  };

  const classify = async (id: string, categoryId: string | null) => {
    const draft = drafts[id] ?? { purposeNote: '', notes: '' };
    await api.updateDrive(id, {
      categoryId,
      purposeNote: draft.purposeNote.trim() || null,
      notes: draft.notes.trim() || null,
    });
    await load();
  };

  const classifyBatch = async (categoryId: string | null) => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    // Persist per-card notes/purpose first for selected rows
    await Promise.all(
      ids.map((id) => {
        const draft = drafts[id] ?? { purposeNote: '', notes: '' };
        return api.updateDrive(id, {
          purposeNote: draft.purposeNote.trim() || null,
          notes: draft.notes.trim() || null,
        });
      }),
    );
    await api.batchClassify(ids, categoryId);
    setSelectedIds(new Set());
    await load();
  };

  const simulate = async () => {
    setSimulating(true);
    setError(null);
    try {
      await api.simulateDrive();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Simulate failed');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="page">
      <div className="triage">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Unclassified</h2>
              <div className="muted">
                {drives.length} drives · {totalMiles} mi
              </div>
            </div>
            <div className="actions">
              {authMode === 'mock' && (
                <button
                  className="btn ghost"
                  disabled={simulating}
                  onClick={() => void simulate()}
                >
                  {simulating ? 'Simulating…' : 'Simulate drive'}
                </button>
              )}
              <Link className="btn ghost" to="/categories">
                Categories
              </Link>
            </div>
          </div>
          {selectedIds.size > 0 && (
            <div className="purpose-bar">
              <div className="muted" style={{ marginBottom: '0.45rem' }}>
                Batch classify {selectedIds.size} selected
              </div>
              <div className="actions">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    className={`btn ${c.deductible ? 'business' : 'personal'}`}
                    onClick={() => void classifyBatch(c.id)}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="drive-list">
            {loading && <p className="muted">Loading drives…</p>}
            {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
            {!loading && !drives.length && (
              <p className="muted">
                {authMode === 'mock'
                  ? 'Inbox zero. Use “Simulate drive” to add a demo trip.'
                  : 'Inbox zero. New drives show up here once your car finishes a trip.'}
              </p>
            )}
            {weekGroups.map((group) => (
              <div key={group.start.toISOString()} className="week-group">
                <div className="week-label">{weekLabel(group.start)}</div>
                {group.drives.map((d) => {
                  const draft = drafts[d.id] ?? {
                    purposeNote: '',
                    notes: '',
                  };
                  return (
                    <div
                      key={d.id}
                      className={`drive-row ${selectedId === d.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(d.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => toggleSelect(d.id)}
                      />
                      <div className="drive-meta">
                        <strong>
                          {d.startAddress ?? 'Start'} → {d.endAddress ?? 'End'}
                        </strong>
                        <span>{formatWhen(d.startedAt)}</span>
                        <span>{d.vehicleName ?? 'Vehicle'}</span>
                        <input
                          className="purpose-input card-field"
                          placeholder="Business purpose (e.g. client meeting)"
                          value={draft.purposeNote}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setDraft(d.id, { purposeNote: e.target.value })
                          }
                        />
                        <textarea
                          className="purpose-input card-field notes-field"
                          placeholder="Notes"
                          rows={2}
                          value={draft.notes}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            setDraft(d.id, { notes: e.target.value })
                          }
                        />
                        <div className="actions" style={{ marginTop: '0.35rem' }}>
                          {categories.map((c) => (
                            <button
                              key={c.id}
                              className={`btn ${c.deductible ? 'business' : 'personal'}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void classify(d.id, c.id);
                              }}
                            >
                              {c.name}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="miles">
                        {d.distanceMiles?.toFixed(1) ?? '—'} mi
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <h2>Route preview</h2>
            {detail && (
              <span className="muted">
                {detail.distanceMiles?.toFixed(1)} mi · odo{' '}
                {detail.startOdometer}
                {detail.endOdometer != null ? ` → ${detail.endOdometer}` : ''}
              </span>
            )}
          </div>
          <DriveMap drive={detail} />
        </section>
      </div>
    </div>
  );
}
