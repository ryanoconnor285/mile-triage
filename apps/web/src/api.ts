import type {
  AppSettings,
  Category,
  DriveDetail,
  DriveSummary,
  ReportSummary,
  User,
  Vehicle,
} from '@mile-triage/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    return res.json() as Promise<T>;
  }
  return undefined as T;
}

export type SetupStatus = {
  authMode: string;
  pairingUrl: string | null;
  publicKeyUrl: string;
  readyForTeslaOauth: boolean;
  checks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
};

export const api = {
  me: () => request<User>('/me'),
  authMode: () => request<{ mode: string }>('/auth/mode'),
  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
  setupStatus: () => request<SetupStatus>('/setup/status'),
  vehicles: () => request<Vehicle[]>('/vehicles'),
  syncVehicles: () =>
    request<{
      synced: number;
      mode: string;
      message: string;
      vehicles: Vehicle[];
    }>('/vehicles/sync', { method: 'POST' }),
  trackVehicle: (id: string, enabled = true) =>
    request<Vehicle>(`/vehicles/${id}/track`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    }),
  markPaired: (id: string) =>
    request<Vehicle>(`/vehicles/${id}/paired`, { method: 'POST' }),
  pairing: (id: string) =>
    request<{
      pairingUrl: string;
      displayName: string | null;
      note?: string;
    }>(`/vehicles/${id}/pairing`),
  categories: () => request<Category[]>('/categories'),
  createCategory: (name: string, deductible: boolean) =>
    request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, deductible }),
    }),
  updateCategory: (
    id: string,
    data: Partial<{ name: string; deductible: boolean; sortOrder: number }>,
  ) =>
    request<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  deleteCategory: (id: string) =>
    request<{ ok: boolean }>(`/categories/${id}`, { method: 'DELETE' }),
  drives: (params?: { status?: string }) => {
    const q = params?.status ? `?status=${params.status}` : '';
    return request<DriveSummary[]>(`/drives${q}`);
  },
  drive: (id: string) => request<DriveDetail>(`/drives/${id}`),
  updateDrive: (
    id: string,
    data: {
      categoryId?: string | null;
      purposeNote?: string | null;
      notes?: string | null;
      status?: 'UNCLASSIFIED' | 'BUSINESS' | 'PERSONAL';
    },
  ) =>
    request<DriveSummary>(`/drives/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  batchClassify: (driveIds: string[], categoryId: string | null) =>
    request<DriveSummary[]>('/drives/batch-classify', {
      method: 'POST',
      body: JSON.stringify({ driveIds, categoryId }),
    }),
  simulateDrive: () =>
    request<{ ok: boolean; label: string; driveId?: string }>(
      '/dev/simulate-drive',
      { method: 'POST' },
    ),
  settings: () => request<AppSettings>('/settings'),
  updateSettings: (data: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  reportSummary: (from: string, to: string) =>
    request<ReportSummary>(
      `/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    ),
};
