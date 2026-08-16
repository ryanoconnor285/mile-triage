import type { Category, DriveStatus } from '@mile-triage/shared';

/** Keep in sync with SYSTEM_TRIP_TYPE_NAMES in @mile-triage/shared */
const SYSTEM_TRIP_TYPE_NAMES = ['Business', 'Personal'] as const;

export function isSystemTripType(name: string): boolean {
  return (SYSTEM_TRIP_TYPE_NAMES as readonly string[]).includes(name);
}

/** User-defined trip types for Business or Personal classification. */
export function tripTypesForStatus(
  categories: Category[],
  status: 'BUSINESS' | 'PERSONAL',
): Category[] {
  const deductible = status === 'BUSINESS';
  return categories.filter(
    (c) => c.deductible === deductible && !isSystemTripType(c.name),
  );
}

export function tripTypesForDrive(
  categories: Category[],
  status: DriveStatus,
): Category[] {
  if (status !== 'BUSINESS' && status !== 'PERSONAL') return [];
  return tripTypesForStatus(categories, status);
}

/** Returns categoryId if it matches status, otherwise null. */
export function tagForStatus(
  categories: Category[],
  categoryId: string | null | undefined,
  status: DriveStatus,
): string | null {
  if (!categoryId) return null;
  const cat = categories.find((c) => c.id === categoryId);
  if (!cat || isSystemTripType(cat.name)) return null;
  if (status === 'BUSINESS' && !cat.deductible) return null;
  if (status === 'PERSONAL' && cat.deductible) return null;
  return categoryId;
}
