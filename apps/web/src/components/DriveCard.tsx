import type { Category, DriveStatus, DriveSummary } from '@mile-triage/shared';
import {
  driveMissingLocation,
  formatDriveRoute,
  formatDriveStatus,
  formatDriveWhen,
  formatTripType,
  statusClass,
} from '../drive-labels';
import { isSystemTripType } from '../category-utils';
import { DriveClassifyControls } from './DriveClassifyControls';

type Props = {
  drive: DriveSummary;
  categories: Category[];
  notes: string;
  categoryId: string;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  showUnclassified?: boolean;
  onNotesChange: (notes: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onClassify: (status: DriveStatus, categoryId?: string | null) => void;
};

export function DriveCard({
  drive,
  categories,
  notes,
  categoryId,
  selectable,
  selected,
  onSelect,
  showUnclassified,
  onNotesChange,
  onCategoryChange,
  onClassify,
}: Props) {
  const missingLocation = driveMissingLocation(drive);

  return (
    <article className="drive-card">
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
          <div className="drive-card-route" title={formatDriveRoute(drive)}>
            {formatDriveRoute(drive)}
          </div>
          {drive.vehicleName && (
            <div className="drive-card-vehicle muted">{drive.vehicleName}</div>
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
        </div>
      </div>
      <DriveClassifyControls
        categories={categories}
        notes={notes}
        categoryId={categoryId}
        currentStatus={drive.status}
        showUnclassified={showUnclassified}
        onNotesChange={onNotesChange}
        onCategoryChange={onCategoryChange}
        onClassify={onClassify}
      />
    </article>
  );
}
