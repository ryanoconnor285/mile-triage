import { useCallback, useRef, useState } from 'react';
import type { Category, DriveStatus, DriveSummary } from '@mile-triage/shared';
import { api } from '../api';
import { tagForStatus } from '../category-utils';

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export type DriveDraft = { notes: string; categoryId: string };

type SavePayload = {
  status: DriveStatus;
  categoryId?: string | null;
  notes?: string | null;
};

export function useDriveSave(categories: Category[]) {
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  const setSaveState = useCallback((id: string, state: SaveState) => {
    setSaveStates((prev) => ({ ...prev, [id]: state }));
  }, []);

  const saveDrive = useCallback(
    async (
      id: string,
      payload: SavePayload,
      drafts: Record<string, DriveDraft>,
      onUpdated: (drive: DriveSummary) => void,
    ) => {
      const draft = drafts[id] ?? { notes: '', categoryId: '' };
      const rawTag =
        payload.categoryId !== undefined
          ? payload.categoryId
          : draft.categoryId || null;
      const tag =
        payload.status === 'UNCLASSIFIED'
          ? null
          : tagForStatus(categories, rawTag, payload.status);

      setSaveState(id, 'saving');
      try {
        const updated = await api.updateDrive(id, {
          status: payload.status,
          categoryId: tag,
          notes:
            payload.notes !== undefined
              ? payload.notes
              : draft.notes.trim() || null,
        });
        onUpdated(updated);
        setSaveState(id, 'saved');
      } catch {
        setSaveState(id, 'error');
      }
    },
    [categories, setSaveState],
  );

  const scheduleDetailsSave = useCallback(
    (
      id: string,
      status: DriveStatus,
      drafts: Record<string, DriveDraft>,
      onUpdated: (drive: DriveSummary) => void,
    ) => {
      if (status === 'UNCLASSIFIED') return;
      const existing = debounceTimers.current[id];
      if (existing) clearTimeout(existing);
      debounceTimers.current[id] = setTimeout(() => {
        void saveDrive(id, { status }, drafts, onUpdated);
      }, 600);
    },
    [saveDrive],
  );

  const markEditing = useCallback(
    (id: string) => {
      if (saveStates[id] === 'saved') {
        setSaveState(id, 'idle');
      }
    },
    [saveStates, setSaveState],
  );

  return {
    saveStates,
    saveDrive,
    scheduleDetailsSave,
    markEditing,
  };
}
