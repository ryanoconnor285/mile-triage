import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Category, DriveSummary, Vehicle } from '@mile-triage/shared';
import { Link } from 'react-router-dom';
import { api } from '../api';
import {
  driveMissingLocation,
  formatDriveEnd,
  formatDriveStart,
  formatDriveWhen,
} from '../drive-labels';

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

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

const emptyEntry = () => ({
  date: todayLocal(),
  miles: '',
  categoryId: '',
  purposeNote: '',
  startAddress: '',
  endAddress: '',
  vehicleId: '',
});

export function TriagePage() {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState(emptyEntry);
  const [savingEntry, setSavingEntry] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [list, cats, mode, cars] = await Promise.all([
        api.drives({ status: 'UNCLASSIFIED' }),
        api.categories(),
        api.authMode(),
        api.vehicles(),
      ]);
      setDrives(list);
      setCategories(cats);
      setAuthMode(mode.mode);
      setVehicles(cars);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load drives');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

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

  const allSelected =
    drives.length > 0 && drives.every((d) => selectedIds.has(d.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(drives.map((d) => d.id)));
  };

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
    if (!categoryId) return;
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
    if (!ids.length || !categoryId) return;
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

  const addDrive = async () => {
    const miles = Number(entry.miles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setError('Enter a distance greater than zero');
      return;
    }
    setSavingEntry(true);
    setError(null);
    try {
      await api.createDrive({
        date: entry.date,
        distanceMiles: miles,
        categoryId: entry.categoryId || null,
        vehicleId: entry.vehicleId || null,
        purposeNote: entry.purposeNote.trim() || null,
        startAddress: entry.startAddress.trim() || null,
        endAddress: entry.endAddress.trim() || null,
      });
      setEntry(emptyEntry());
      setEntryOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add drive');
    } finally {
      setSavingEntry(false);
    }
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
    <div className="page drive-workspace">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Unclassified</h2>
            <div className="muted">
              {drives.length} drives · {totalMiles} mi
            </div>
          </div>
          <div className="actions">
            <button
              className="btn ghost"
              onClick={() => setEntryOpen((open) => !open)}
            >
              {entryOpen ? 'Cancel' : 'Add drive'}
            </button>
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

        {entryOpen && (
          <div className="purpose-bar">
            <div className="muted" style={{ marginBottom: '0.45rem' }}>
              Add a drive by hand
            </div>
            <div className="entry-grid">
              <label>
                <span className="muted">Date</span>
                <input
                  className="purpose-input"
                  type="date"
                  max={todayLocal()}
                  value={entry.date}
                  onChange={(e) => setEntry({ ...entry, date: e.target.value })}
                />
              </label>
              <label>
                <span className="muted">Miles</span>
                <input
                  className="purpose-input"
                  type="number"
                  min="0"
                  step="0.1"
                  inputMode="decimal"
                  placeholder="12.4"
                  value={entry.miles}
                  onChange={(e) => setEntry({ ...entry, miles: e.target.value })}
                />
              </label>
              <label>
                <span className="muted">Category</span>
                <select
                  className="purpose-input"
                  value={entry.categoryId}
                  onChange={(e) =>
                    setEntry({ ...entry, categoryId: e.target.value })
                  }
                >
                  <option value="">Decide later</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {vehicles.length > 0 && (
                <label>
                  <span className="muted">Vehicle</span>
                  <select
                    className="purpose-input"
                    value={entry.vehicleId}
                    onChange={(e) =>
                      setEntry({ ...entry, vehicleId: e.target.value })
                    }
                  >
                    <option value="">No vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.displayName ?? v.vin}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                <span className="muted">From</span>
                <input
                  className="purpose-input"
                  placeholder="Optional"
                  value={entry.startAddress}
                  onChange={(e) =>
                    setEntry({ ...entry, startAddress: e.target.value })
                  }
                />
              </label>
              <label>
                <span className="muted">To</span>
                <input
                  className="purpose-input"
                  placeholder="Optional"
                  value={entry.endAddress}
                  onChange={(e) =>
                    setEntry({ ...entry, endAddress: e.target.value })
                  }
                />
              </label>
              <label className="entry-wide">
                <span className="muted">Purpose</span>
                <input
                  className="purpose-input"
                  placeholder="Client meeting, site visit…"
                  value={entry.purposeNote}
                  onChange={(e) =>
                    setEntry({ ...entry, purposeNote: e.target.value })
                  }
                />
              </label>
            </div>
            <div className="actions" style={{ marginTop: '0.6rem' }}>
              <button
                className="btn"
                disabled={savingEntry}
                onClick={() => void addDrive()}
              >
                {savingEntry ? 'Saving…' : 'Save drive'}
              </button>
            </div>
          </div>
        )}

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

        <div className="drive-table-wrap">
          {loading && <p className="table-message muted">Loading drives…</p>}
          {error && (
            <p className="table-message" style={{ color: 'var(--danger)' }}>
              {error}
            </p>
          )}
          {!loading && !drives.length && (
            <p className="table-message muted">
              {authMode === 'mock'
                ? 'Inbox zero. Use “Simulate drive” to add a demo trip.'
                : 'Inbox zero. New drives show up here once your car finishes a trip.'}
            </p>
          )}
          {drives.length > 0 && (
            <table className="drive-table">
              <thead>
                <tr>
                  <th className="col-check">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      aria-label="Select all drives"
                    />
                  </th>
                  <th>When</th>
                  <th>From</th>
                  <th>To</th>
                  <th className="col-num">Mi</th>
                  <th>Vehicle</th>
                  <th>Purpose</th>
                  <th>Notes</th>
                  <th>Classify</th>
                </tr>
              </thead>
              <tbody>
                {weekGroups.map((group) => (
                  <Fragment key={group.start.toISOString()}>
                    <tr className="week-row">
                      <td colSpan={9}>{weekLabel(group.start)}</td>
                    </tr>
                    {group.drives.map((d) => {
                      const draft = drafts[d.id] ?? {
                        purposeNote: '',
                        notes: '',
                      };
                      const missingLocation = driveMissingLocation(d);
                      return (
                        <tr key={d.id}>
                          <td className="col-check">
                            <input
                              type="checkbox"
                              checked={selectedIds.has(d.id)}
                              onChange={() => toggleSelect(d.id)}
                              aria-label={`Select drive on ${formatDriveWhen(d.startedAt)}`}
                            />
                          </td>
                          <td className="col-when">{formatDriveWhen(d.startedAt)}</td>
                          <td className="col-place" title={formatDriveStart(d)}>
                            {formatDriveStart(d)}
                          </td>
                          <td className="col-place" title={formatDriveEnd(d)}>
                            {formatDriveEnd(d)}
                          </td>
                          <td className="col-num">
                            {d.distanceMiles?.toFixed(1) ?? '—'}
                          </td>
                          <td className="col-vehicle">
                            {d.vehicleName ?? '—'}
                          </td>
                          <td>
                            <input
                              className="table-input"
                              placeholder="Purpose"
                              value={draft.purposeNote}
                              onChange={(e) =>
                                setDraft(d.id, { purposeNote: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="table-input"
                              placeholder="Notes"
                              value={draft.notes}
                              onChange={(e) =>
                                setDraft(d.id, { notes: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <select
                              className="table-select"
                              defaultValue=""
                              onChange={(e) => {
                                void classify(d.id, e.target.value || null);
                                e.target.value = '';
                              }}
                            >
                              <option value="">Choose…</option>
                              {categories.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            {missingLocation && (
                              <span className="row-hint">No GPS on file</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
