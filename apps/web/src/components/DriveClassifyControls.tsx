import type { Category, DriveStatus } from '@mile-triage/shared';
import { tripTypesForStatus } from '../category-utils';
import type { SaveState } from '../hooks/useDriveSave';

type Props = {
  categories: Category[];
  notes: string;
  categoryId: string;
  currentStatus?: DriveStatus;
  saveState?: SaveState;
  compact?: boolean;
  showUnclassified?: boolean;
  onNotesChange: (notes: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClassify: (status: DriveStatus, categoryId?: string | null) => void;
  onSaveDetails?: () => void;
};

export function DriveClassifyControls({
  categories,
  notes,
  categoryId,
  currentStatus,
  saveState = 'idle',
  compact,
  showUnclassified,
  onNotesChange,
  onCategoryChange,
  onClassify,
  onSaveDetails,
}: Props) {
  const businessTags = tripTypesForStatus(categories, 'BUSINESS');
  const personalTags = tripTypesForStatus(categories, 'PERSONAL');

  const apply = (status: DriveStatus) => {
    onClassify(status, categoryId || null);
  };

  return (
    <div className={`classify-controls ${compact ? 'compact' : ''}`}>
      {saveState === 'saved' && (
        <div className="save-check" aria-live="polite">
          <span className="save-check-icon" aria-hidden="true">
            ✓
          </span>
          Saved
        </div>
      )}
      {saveState === 'error' && (
        <div className="save-error" role="alert">
          Could not save — try again
        </div>
      )}
      <div className="classify-row">
        <button
          type="button"
          className={`btn business classify-btn ${currentStatus === 'BUSINESS' ? 'active' : ''} ${saveState === 'saving' && currentStatus === 'BUSINESS' ? 'saving' : ''}`}
          disabled={saveState === 'saving'}
          onClick={() => apply('BUSINESS')}
        >
          Business
        </button>
        <button
          type="button"
          className={`btn personal classify-btn ${currentStatus === 'PERSONAL' ? 'active' : ''} ${saveState === 'saving' && currentStatus === 'PERSONAL' ? 'saving' : ''}`}
          disabled={saveState === 'saving'}
          onClick={() => apply('PERSONAL')}
        >
          Personal
        </button>
      </div>
      {showUnclassified && currentStatus !== 'UNCLASSIFIED' && (
        <button
          type="button"
          className="btn ghost classify-unclassify"
          disabled={saveState === 'saving'}
          onClick={() => onClassify('UNCLASSIFIED', null)}
        >
          Move to inbox
        </button>
      )}
      <label className="classify-field">
        <span className="muted">Trip type</span>
        <select
          className="table-select"
          value={categoryId}
          onChange={(e) => {
            onCategoryChange(e.target.value);
            onSaveDetails?.();
          }}
        >
          <option value="">None</option>
          {businessTags.length > 0 && (
            <optgroup label="Business">
              {businessTags.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          {personalTags.length > 0 && (
            <optgroup label="Personal">
              {personalTags.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>
      <label className="classify-field">
        <span className="muted">Notes</span>
        <input
          className="table-input"
          placeholder=""
          value={notes}
          onChange={(e) => {
            onNotesChange(e.target.value);
            onSaveDetails?.();
          }}
        />
      </label>
    </div>
  );
}

/** Business/Personal pair for forms (e.g. manual add drive). */
export function ClassificationButtons({
  value,
  onChange,
}: {
  value: '' | 'BUSINESS' | 'PERSONAL';
  onChange: (v: '' | 'BUSINESS' | 'PERSONAL') => void;
}) {
  return (
    <div className="classify-row classification-picker">
      <button
        type="button"
        className={`btn ghost classify-btn ${value === '' ? 'active' : ''}`}
        onClick={() => onChange('')}
      >
        Later
      </button>
      <button
        type="button"
        className={`btn business classify-btn ${value === 'BUSINESS' ? 'active' : ''}`}
        onClick={() => onChange('BUSINESS')}
      >
        Business
      </button>
      <button
        type="button"
        className={`btn personal classify-btn ${value === 'PERSONAL' ? 'active' : ''}`}
        onClick={() => onChange('PERSONAL')}
      >
        Personal
      </button>
    </div>
  );
}
