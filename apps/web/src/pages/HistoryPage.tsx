import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Category, DriveStatus, DriveSummary } from '@mile-triage/shared';
import { api } from '../api';
import { isSystemTripType, tagForStatus } from '../category-utils';
import { DriveCard } from '../components/DriveCard';
import { DriveClassifyControls } from '../components/DriveClassifyControls';
import {
  formatDriveEnd,
  formatDriveStart,
  formatDriveStatus,
  formatDriveWhen,
  formatTripType,
  statusClass,
} from '../drive-labels';

export function HistoryPage() {
  const [drives, setDrives] = useState<DriveSummary[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'BUSINESS' | 'PERSONAL' | string>(
    'ALL',
  );
  const [drafts, setDrafts] = useState<
    Record<string, { notes: string; categoryId: string }>
  >({});
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
      setDrafts((prev) => {
        const next: Record<string, { notes: string; categoryId: string }> = {};
        for (const d of merged) {
          next[d.id] = prev[d.id] ?? {
            notes: d.notes ?? '',
            categoryId: d.categoryId ?? '',
          };
        }
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load history');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const tripTypeFilters = useMemo(
    () => categories.filter((c) => !isSystemTripType(c.name)),
    [categories],
  );

  const visible = useMemo(() => {
    if (filter === 'ALL') return drives;
    if (filter === 'BUSINESS' || filter === 'PERSONAL') {
      return drives.filter((d) => d.status === filter);
    }
    return drives.filter((d) => d.categoryId === filter);
  }, [drives, filter]);

  const setDraft = (id: string, patch: Partial<{ notes: string; categoryId: string }>) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        notes: prev[id]?.notes ?? '',
        categoryId: prev[id]?.categoryId ?? '',
        ...patch,
      },
    }));
  };

  const reclassify = async (
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

  return (
    <div className="page drive-workspace">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>History</h2>
            <div className="muted">{visible.length} classified drives</div>
          </div>
        </div>

        <div className="filter-scroll">
          <button
            className={`btn ghost filter-chip ${filter === 'ALL' ? 'active-filter' : ''}`}
            onClick={() => setFilter('ALL')}
          >
            All
          </button>
          <button
            className={`btn ghost filter-chip ${filter === 'BUSINESS' ? 'active-filter' : ''}`}
            onClick={() => setFilter('BUSINESS')}
          >
            Business
          </button>
          <button
            className={`btn ghost filter-chip ${filter === 'PERSONAL' ? 'active-filter' : ''}`}
            onClick={() => setFilter('PERSONAL')}
          >
            Personal
          </button>
          {tripTypeFilters.map((c) => (
            <button
              key={c.id}
              className={`btn ghost filter-chip ${filter === c.id ? 'active-filter' : ''}`}
              onClick={() => setFilter(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="drive-list-wrap">
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
            <div className="drive-cards mobile-only">
              {visible.map((d) => {
                const draft = drafts[d.id] ?? { notes: '', categoryId: '' };
                return (
                  <DriveCard
                    key={d.id}
                    drive={d}
                    categories={categories}
                    notes={draft.notes}
                    categoryId={draft.categoryId}
                    showUnclassified
                    onNotesChange={(notes) => setDraft(d.id, { notes })}
                    onCategoryChange={(categoryId) =>
                      setDraft(d.id, { categoryId })
                    }
                    onClassify={(status, categoryId) =>
                      void reclassify(d.id, status, categoryId)
                    }
                  />
                );
              })}
            </div>
          )}

          {visible.length > 0 && (
            <div className="drive-table-wrap desktop-only">
              <table className="drive-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Classification</th>
                    <th>Trip type</th>
                    <th>From</th>
                    <th>To</th>
                    <th className="col-num">Mi</th>
                    <th>Vehicle</th>
                    <th>Notes</th>
                    <th>Reclassify</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((d) => {
                    const draft = drafts[d.id] ?? { notes: '', categoryId: '' };
                    return (
                      <tr key={d.id}>
                        <td className="col-when">
                          {formatDriveWhen(d.startedAt)}
                        </td>
                        <td>
                          <span
                            className={`status-badge ${statusClass(d.status)}`}
                          >
                            {formatDriveStatus(d.status)}
                          </span>
                        </td>
                        <td className="col-text">
                          {formatTripType(d.categoryName)}
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
                        <td className="col-text">
                          {draft.notes || d.notes || '—'}
                          {d.purposeNote && (
                            <span className="row-hint block">
                              Legacy: {d.purposeNote}
                            </span>
                          )}
                        </td>
                        <td className="col-classify">
                          <DriveClassifyControls
                            compact
                            categories={categories}
                            notes={draft.notes}
                            categoryId={draft.categoryId}
                            currentStatus={d.status}
                            showUnclassified
                            onNotesChange={(notes) => setDraft(d.id, { notes })}
                            onCategoryChange={(categoryId) =>
                              setDraft(d.id, { categoryId })
                            }
                            onClassify={(status, categoryId) =>
                              void reclassify(d.id, status, categoryId)
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
