import { useState } from 'react';
import type { Category, DriveStatus, DriveSummary } from '@mile-triage/shared';
import {
  driveMissingLocation,
  formatDriveEnd,
  formatDriveStart,
  formatDriveStatus,
  formatDriveWhen,
  formatTripType,
  statusClass,
} from '../drive-labels';
import { isSystemTripType } from '../category-utils';
import type { SaveState } from '../hooks/useDriveSave';
import { DriveClassifyControls } from './DriveClassifyControls';

type Props = {
  drive: DriveSummary;
  categories: Category[];
  notes: string;
  categoryId: string;
  saveState?: SaveState;
  saved?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  showUnclassified?: boolean;
  onNotesChange: (notes: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClassify: (status: DriveStatus, categoryId?: string | null) => void;
  onSaveDetails?: () => void;
  onApplyRouteSuggestion?: () => void;
  onSaveAsRoute?: () => void;
};

export function DriveCard({
  drive,
  categories,
  notes,
  categoryId,
  saveState,
  saved,
  selectable,
  selected,
  onSelect,
  showUnclassified,
  onNotesChange,
  onCategoryChange,
  onClassify,
  onSaveDetails,
  onApplyRouteSuggestion,
  onSaveAsRoute,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const missingLocation = driveMissingLocation(drive);

  return (
    <article
      className={`drive-card ${saved || saveState === 'saved' ? 'is-saved' : ''}`}
    >
      <div className="drive-card-head">
        {selectable && (
          <input
            type="checkbox"
            className="drive-card-check"
            checked={selected}
            onChange={onSelect}
            aria-label={`Select drive on ${formatDriveWhen(drive.startedAt)}`}
          />
        )}
        <div className="drive-card-meta">
          <div className="drive-card-when">
            {formatDriveWhen(drive.startedAt)}
            <span className="drive-card-miles">
              {drive.distanceMiles?.toFixed(1) ?? '—'} mi
            </span>
          </div>
          <button
            type="button"
            className="drive-card-route-btn"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            <span className="drive-card-route-from">{formatDriveStart(drive)}</span>
            <span className="drive-card-route-arrow">→</span>
            <span className="drive-card-route-to">{formatDriveEnd(drive)}</span>
          </button>
          {expanded && (
            <div className="drive-card-route-expanded muted">
              <div>{formatDriveStart(drive)}</div>
              <div>{formatDriveEnd(drive)}</div>
            </div>
          )}
          {drive.vehicleName && (
            <div className="drive-card-vehicle muted">{drive.vehicleName}</div>
          )}
          {drive.routeSuggestion && (
            <div className="route-suggestion">
              <span className="muted">Suggested:</span>{' '}
              <button
                type="button"
                className="route-suggestion-chip"
                onClick={onApplyRouteSuggestion}
              >
                {drive.routeSuggestion.routeName}
              </button>
            </div>
          )}
          {drive.status !== 'UNCLASSIFIED' && (
            <div className="drive-card-badges">
              <span className={`status-badge ${statusClass(drive.status)}`}>
                {formatDriveStatus(drive.status)}
              </span>
              {drive.categoryName && !isSystemTripType(drive.categoryName) && (
                <span className="trip-type-badge">
                  {formatTripType(drive.categoryName)}
                </span>
              )}
            </div>
          )}
          {missingLocation && (
            <span className="row-hint">No GPS on file</span>
          )}
          {drive.purposeNote && (
            <div className="drive-card-legacy muted">
              Purpose (legacy): {drive.purposeNote}
            </div>
          )}
          {onSaveAsRoute && drive.startLat != null && (
            <button
              type="button"
              className="btn ghost save-route-btn"
              onClick={onSaveAsRoute}
            >
              Save as route
            </button>
          )}
        </div>
      </div>
      <DriveClassifyControls
        categories={categories}
        notes={notes}
        categoryId={categoryId}
        currentStatus={drive.status}
        saveState={saveState}
        showUnclassified={showUnclassified}
        onNotesChange={onNotesChange}
        onCategoryChange={onCategoryChange}
        onClassify={onClassify}
        onSaveDetails={onSaveDetails}
      />
    </article>
  );
}
