import type { Category, DriveStatus } from '@mile-triage/shared';
import { tripTypesForStatus } from '../category-utils';

type Props = {
  categories: Category[];
  notes: string;
  categoryId: string;
  currentStatus?: DriveStatus;
  compact?: boolean;
  showUnclassified?: boolean;
  onNotesChange: (notes: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClassify: (status: DriveStatus, categoryId?: string | null) => void;
};

export function DriveClassifyControls({
  categories,
  notes,
  categoryId,
  currentStatus,
  compact,
  showUnclassified,
  onNotesChange,
  onCategoryChange,
  onClassify,
}: Props) {
  const businessTags = tripTypesForStatus(categories, 'BUSINESS');
  const personalTags = tripTypesForStatus(categories, 'PERSONAL');

  const apply = (status: DriveStatus) => {
    const tagId = categoryId || null;
    onClassify(status, tagId);
  };

  return (
    <div className={`classify-controls ${compact ? 'compact' : ''}`}>
      <div className="classify-row">
        <button
          type="button"
          className="btn business classify-btn"
          onClick={() => apply('BUSINESS')}
        >
          Business
        </button>
        <button
          type="button"
          className="btn personal classify-btn"
          onClick={() => apply('PERSONAL')}
        >
          Personal
        </button>
      </div>
      {showUnclassified && currentStatus !== 'UNCLASSIFIED' && (
        <button
          type="button"
          className="btn ghost classify-unclassify"
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
          onChange={(e) => onCategoryChange(e.target.value)}
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
          onChange={(e) => onNotesChange(e.target.value)}
        />
      </label>
    </div>
  );
}
