import { useEffect, useMemo, useState } from 'react';
import type { Category, SavedRoute } from '@mile-triage/shared';
import { api } from '../api';
import { isSystemTripType } from '../category-utils';

type SavedRouteRow = SavedRoute & {
  suggestedCategory?: { id: string; name: string } | null;
};

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [routes, setRoutes] = useState<SavedRouteRow[]>([]);
  const [name, setName] = useState('');
  const [deductible, setDeductible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [cats, savedRoutes] = await Promise.all([
        api.categories(),
        api.routes(),
      ]);
      setCategories(cats);
      setRoutes(savedRoutes as SavedRouteRow[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trip types');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const businessTypes = useMemo(
    () =>
      categories.filter((c) => c.deductible && !isSystemTripType(c.name)),
    [categories],
  );
  const personalTypes = useMemo(
    () =>
      categories.filter((c) => !c.deductible && !isSystemTripType(c.name)),
    [categories],
  );

  const categoryName = (id: string | null | undefined) => {
    if (!id) return 'None';
    const c = categories.find((cat) => cat.id === id);
    return c?.name ?? 'Unknown';
  };

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.createCategory(name.trim(), deductible);
      setName('');
      setDeductible(true);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const remove = async (c: Category) => {
    try {
      await api.deleteCategory(c.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const removeRoute = async (route: SavedRouteRow) => {
    try {
      await api.deleteRoute(route.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete route failed');
    }
  };

  const renderList = (items: Category[], empty: string) => {
    if (!items.length) {
      return <p className="muted trip-type-empty">{empty}</p>;
    }
    return (
      <div className="card-list">
        {items.map((c) => (
          <div className="trip-type-row" key={c.id}>
            <strong>{c.name}</strong>
            <button className="btn ghost" onClick={() => void remove(c)}>
              Delete
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Trip types
        </h1>
        <p className="muted">
          Optional labels for common trips (e.g. job site, supply run).
          Classification is always Business or Personal.
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="trip-type-form">
        <label>
          <div className="muted">New trip type</div>
          <input
            className="purpose-input"
            style={{ marginTop: '0.35rem' }}
            placeholder="e.g. Job site, Supply run"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="muted trip-type-bucket">
          <span>For</span>
          <select
            className="purpose-input"
            value={deductible ? 'business' : 'personal'}
            onChange={(e) => setDeductible(e.target.value === 'business')}
          >
            <option value="business">Business trips</option>
            <option value="personal">Personal trips</option>
          </select>
        </label>
        <button className="btn" onClick={() => void create()}>
          Add
        </button>
      </div>

      <section>
        <h2 className="section-title">Business trip types</h2>
        {renderList(businessTypes, 'No business trip types yet.')}
      </section>

      <section>
        <h2 className="section-title">Personal trip types</h2>
        {renderList(personalTypes, 'No personal trip types yet.')}
      </section>

      <section>
        <h2 className="section-title">Saved routes</h2>
        <p className="muted">
          Named trip patterns (e.g. Home → Duke) suggest a trip type on
          unclassified drives. You still choose Business or Personal.
        </p>
        {!routes.length ? (
          <p className="muted trip-type-empty">No saved routes yet.</p>
        ) : (
          <div className="card-list">
            {routes.map((route) => (
              <div className="trip-type-row saved-route-row" key={route.id}>
                <div>
                  <strong>{route.name}</strong>
                  <div className="muted saved-route-meta">
                    Suggested trip type:{' '}
                    {categoryName(
                      route.suggestedCategoryId ??
                        route.suggestedCategory?.id,
                    )}
                  </div>
                </div>
                <button
                  className="btn ghost"
                  onClick={() => void removeRoute(route)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
