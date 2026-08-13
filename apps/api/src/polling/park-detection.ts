/**
 * Park-based drive detection.
 *
 * Rather than following a car in real time, this compares the odometer between
 * two sightings of a *parked* car. The last parked sighting is the "anchor"; a
 * trip is recognised once the car is parked again further along the odometer.
 *
 * The consequence is that polling can be slow and lossy without losing trips:
 * skipping every poll during a drive still produces one drive with the right
 * distance and endpoints. What it cannot recover is the route between them, and
 * the duration unless departure happened to be observed.
 */

/** Ignore odometer noise and parking-lot shuffling. */
export const MIN_TRIP_MILES = 0.1;

export const POLL_INTERVALS_MS = {
  /** In gear: poll often enough to notice the park and to time the trip. */
  driving: 2 * 60_000,
  /** Parked and awake: the next departure is the only thing we are waiting for. */
  parked: 10 * 60_000,
  /** Asleep or offline: nothing to learn, and asking cannot wake it. */
  unreachable: 20 * 60_000,
} as const;

/** Gears that mean the car is in motion or about to be. */
const MOVING_GEARS = new Set(['D', 'R', 'N']);

/** Tesla uses both 'P' and null for a parked car. */
export function isParked(shiftState: string | null): boolean {
  return !MOVING_GEARS.has((shiftState ?? 'P').toUpperCase());
}

export type PollState = {
  anchorOdometer: number | null;
  anchorLat: number | null;
  anchorLng: number | null;
  anchorAt: Date | null;
  tripStartedAt: Date | null;
  lastShiftState: string | null;
};

export type Observation = {
  reachable: boolean;
  odometer: number | null;
  lat: number | null;
  lng: number | null;
  shiftState: string | null;
  observedAt: Date;
};

export type DetectedDrive = {
  startedAt: Date;
  endedAt: Date;
  startOdometer: number;
  endOdometer: number;
  distanceMiles: number;
  /** Null unless departure was observed; poll spacing is not a duration. */
  durationSec: number | null;
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
};

export type Decision = {
  drive: DetectedDrive | null;
  state: PollState;
  intervalMs: number;
  reason: string;
};

function anchorTo(
  obs: Observation,
): Pick<PollState, 'anchorOdometer' | 'anchorLat' | 'anchorLng' | 'anchorAt'> {
  return {
    anchorOdometer: obs.odometer,
    anchorLat: obs.lat,
    anchorLng: obs.lng,
    anchorAt: obs.observedAt,
  };
}

export function decide(state: PollState, obs: Observation): Decision {
  // Asleep or offline carries no information. Holding the anchor is what lets a
  // drive still be detected after the car wakes up somewhere else.
  if (!obs.reachable) {
    return {
      drive: null,
      state,
      intervalMs: POLL_INTERVALS_MS.unreachable,
      reason: 'unreachable',
    };
  }

  if (!isParked(obs.shiftState)) {
    return {
      drive: null,
      state: {
        ...state,
        // Keep the anchor where the car was parked so the trip start survives.
        tripStartedAt: state.tripStartedAt ?? obs.observedAt,
        lastShiftState: obs.shiftState,
      },
      intervalMs: POLL_INTERVALS_MS.driving,
      reason: 'in gear',
    };
  }

  // Parked from here on.
  if (obs.odometer === null) {
    return {
      drive: null,
      state: { ...state, lastShiftState: obs.shiftState },
      intervalMs: POLL_INTERVALS_MS.parked,
      reason: 'parked, odometer unavailable',
    };
  }

  const { anchorOdometer, anchorAt } = state;
  if (anchorOdometer === null || anchorAt === null) {
    return {
      drive: null,
      state: {
        ...anchorTo(obs),
        tripStartedAt: null,
        lastShiftState: obs.shiftState,
      },
      intervalMs: POLL_INTERVALS_MS.parked,
      reason: 'first sighting, anchor set',
    };
  }

  const delta = obs.odometer - anchorOdometer;

  if (delta < MIN_TRIP_MILES) {
    // Covers both "hasn't moved" and a negative reading from replaced hardware.
    return {
      drive: null,
      state: {
        ...anchorTo(obs),
        tripStartedAt: null,
        lastShiftState: obs.shiftState,
      },
      intervalMs: POLL_INTERVALS_MS.parked,
      reason:
        delta < 0 ? 'odometer went backwards, re-anchored' : 'no movement',
    };
  }

  const departedAt = state.tripStartedAt;
  const durationSec = departedAt
    ? Math.max(
        0,
        Math.round((obs.observedAt.getTime() - departedAt.getTime()) / 1000),
      )
    : null;

  return {
    drive: {
      startedAt: departedAt ?? anchorAt,
      endedAt: obs.observedAt,
      startOdometer: anchorOdometer,
      endOdometer: obs.odometer,
      distanceMiles: Number(delta.toFixed(2)),
      durationSec,
      startLat: state.anchorLat,
      startLng: state.anchorLng,
      endLat: obs.lat,
      endLng: obs.lng,
    },
    state: {
      ...anchorTo(obs),
      tripStartedAt: null,
      lastShiftState: obs.shiftState,
    },
    intervalMs: POLL_INTERVALS_MS.parked,
    reason: 'drive detected',
  };
}
