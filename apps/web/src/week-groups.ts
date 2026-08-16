import type { DriveSummary } from '@mile-triage/shared';

export function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d;
}

export function weekLabel(start: Date) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

export function groupDrivesByWeek(drives: DriveSummary[]) {
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
}
