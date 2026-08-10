import { useEffect, useState } from 'react';
import type { Category } from '@mile-triage/shared';
import { api } from '../api';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [deductible, setDeductible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setCategories(await api.categories());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load categories');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.createCategory(name.trim(), deductible);
      setName('');
      setDeductible(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  };

  const toggleDeductible = async (c: Category) => {
    await api.updateCategory(c.id, { deductible: !c.deductible });
    await load();
  };

  const remove = async (c: Category) => {
    try {
      await api.deleteCategory(c.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="page stack">
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 0 }}>
          Categories
        </h1>
        <p className="muted">
          Custom labels for trips. Mark which ones count toward tax deductions.
        </p>
      </div>
      {error && <p style={{ color: 'var(--danger)' }}>{error}</p>}
      <div className="vehicle-card" style={{ alignItems: 'end' }}>
        <label style={{ flex: 1 }}>
          <div className="muted">New category</div>
          <input
            className="purpose-input"
            style={{ marginTop: '0.35rem' }}
            placeholder="e.g. Client site, Commute, Medical"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="muted" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={deductible}
            onChange={(e) => setDeductible(e.target.checked)}
          />
          Deductible
        </label>
        <button className="btn" onClick={() => void create()}>
          Add
        </button>
      </div>
      <div className="card-list">
        {categories.map((c) => (
          <div className="vehicle-card" key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <div className="muted">
                {c.deductible
                  ? 'Counts toward mileage deduction'
                  : 'Not deductible'}
              </div>
            </div>
            <div className="actions">
              <button
                className="btn secondary"
                onClick={() => void toggleDeductible(c)}
              >
                {c.deductible ? 'Make personal' : 'Make deductible'}
              </button>
              <button className="btn ghost" onClick={() => void remove(c)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
