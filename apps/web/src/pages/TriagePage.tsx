import { Fragment, useEffect, useMemo, useState } from 'react';
import type { Category, DriveStatus, DriveSummary, Vehicle } from '@mile-triage/shared';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { tagForStatus, tripTypesForStatus } from '../category-utils';
import { DriveCard } from '../components/DriveCard';
import { DriveClassifyControls } from '../components/DriveClassifyControls';
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

type Draft = { notes: string; categoryId: string };

function todayLocal() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

const emptyEntry = () => ({
  date: todayLocal(),
  miles: '',
  status: '' as '' | 'BUSINESS' | 'PERSONAL',
  categoryId: '',
  notes: '',
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
  const [batchCategoryId, setBatchCategoryId] = useState('');
  const [batchNotes, setBatchNotes] = useState('');

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
            notes: d.notes ?? '',
            categoryId: d.categoryId ?? '',
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
        notes: prev[id]?.notes ?? '',
        categoryId: prev[id]?.categoryId ?? '',
        ...patch,
      },
    }));
  };

  const classify = async (
    id: string,
    status: DriveStatus,
    categoryId?: string | null,
  ) => {
    const draft = drafts[id] ?? { notes: '', categoryId: '' };
    const rawTag =
      categoryId !== undefined ? categoryId : draft.categoryId || null;
    const tag =
      status === 'UNCLASSIFIED'
        ? null
        : tagForStatus(categories, rawTag, status);
    await api.updateDrive(id, {
      status,
      categoryId: tag,
      notes: draft.notes.trim() || null,
    });
    await load();
  };

  const classifyBatch = async (status: 'BUSINESS' | 'PERSONAL') => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    await api.batchClassify(ids, {
      status,
      categoryId: tagForStatus(categories, batchCategoryId, status),
      notes: batchNotes.trim() || null,
    });
    setSelectedIds(new Set());
    setBatchCategoryId('');
    setBatchNotes('');
    await load();
  };

  const entryTripTypes = entry.status
    ? tripTypesForStatus(categories, entry.status)
    : [];

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
        status: entry.status || undefined,
        categoryId: entry.categoryId || null,
        vehicleId: entry.vehicleId || null,
        notes: entry.notes.trim() || null,
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

  const renderDriveRow = (d: DriveSummary) => {
    const draft = drafts[d.id] ?? { notes: '', categoryId: '' };
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
        <td className="col-num">{d.distanceMiles?.toFixed(1) ?? '—'}</td>
        <td className="col-vehicle">{d.vehicleName ?? '—'}</td>
        <td className="col-classify">
          <DriveClassifyControls
            compact
            categories={categories}
            notes={draft.notes}
            categoryId={draft.categoryId}
            onNotesChange={(notes) => setDraft(d.id, { notes })}
            onCategoryChange={(categoryId) => setDraft(d.id, { categoryId })}
            onClassify={(status, categoryId) =>
              void classify(d.id, status, categoryId)
            }
          />
          {missingLocation && (
            <span className="row-hint">No GPS on file</span>
          )}
        </td>
      </tr>
    );
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
          <div className="actions panel-actions">
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
            <Link className="btn ghost desktop-only" to="/trip-types">
              Trip types
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
                <span className="muted">Classification</span>
                <select
                  className="purpose-input"
                  value={entry.status}
                  onChange={(e) =>
                    setEntry({
                      ...entry,
                      status: e.target.value as '' | 'BUSINESS' | 'PERSONAL',
                      categoryId: '',
                    })
                  }
                >
                  <option value="">Decide later</option>
                  <option value="BUSINESS">Business</option>
                  <option value="PERSONAL">Personal</option>
                </select>
              </label>
              {entry.status && (
                <label>
                  <span className="muted">Trip type</span>
                  <select
                    className="purpose-input"
                    value={entry.categoryId}
                    onChange={(e) =>
                      setEntry({ ...entry, categoryId: e.target.value })
                    }
                  >
                    <option value="">None</option>
                    {entryTripTypes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
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
                <span className="muted">Notes</span>
                <input
                  className="purpose-input"
                  value={entry.notes}
                  onChange={(e) => setEntry({ ...entry, notes: e.target.value })}
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

        <div className="drive-list-wrap">
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
            <div className="drive-cards mobile-only">
              {weekGroups.map((group) => (
                <Fragment key={group.start.toISOString()}>
                  <div className="week-label">{weekLabel(group.start)}</div>
                  {group.drives.map((d) => {
                    const draft = drafts[d.id] ?? { notes: '', categoryId: '' };
                    return (
                      <DriveCard
                        key={d.id}
                        drive={d}
                        categories={categories}
                        notes={draft.notes}
                        categoryId={draft.categoryId}
                        selectable
                        selected={selectedIds.has(d.id)}
                        onSelect={() => toggleSelect(d.id)}
                        onNotesChange={(notes) => setDraft(d.id, { notes })}
                        onCategoryChange={(categoryId) =>
                          setDraft(d.id, { categoryId })
                        }
                        onClassify={(status, categoryId) =>
                          void classify(d.id, status, categoryId)
                        }
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          )}

          {drives.length > 0 && (
            <div className="drive-table-wrap desktop-only">
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
                    <th>Classify</th>
                  </tr>
                </thead>
                <tbody>
                  {weekGroups.map((group) => (
                    <Fragment key={group.start.toISOString()}>
                      <tr className="week-row">
                        <td colSpan={7}>{weekLabel(group.start)}</td>
                      </tr>
                      {group.drives.map(renderDriveRow)}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {selectedIds.size > 0 && (
        <div className="sticky-batch-bar">
          <div className="sticky-batch-inner">
            <div className="muted batch-label">
              {selectedIds.size} selected
            </div>
            <label className="batch-field">
              <span className="muted">Trip type</span>
              <select
                className="table-select"
                value={batchCategoryId}
                onChange={(e) => setBatchCategoryId(e.target.value)}
              >
                <option value="">None</option>
                <optgroup label="Business">
                  {tripTypesForStatus(categories, 'BUSINESS').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Personal">
                  {tripTypesForStatus(categories, 'PERSONAL').map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              </select>
            </label>
            <input
              className="table-input batch-notes"
              placeholder="Notes"
              value={batchNotes}
              onChange={(e) => setBatchNotes(e.target.value)}
            />
            <div className="classify-row batch-actions">
              <button
                type="button"
                className="btn business classify-btn"
                onClick={() => void classifyBatch('BUSINESS')}
              >
                Business
              </button>
              <button
                type="button"
                className="btn personal classify-btn"
                onClick={() => void classifyBatch('PERSONAL')}
              >
                Personal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
