import {
  decide,
  isParked,
  POLL_INTERVALS_MS,
  type Observation,
  type PollState,
} from './park-detection';

const HOME: Pick<Observation, 'lat' | 'lng'> = { lat: 40.1, lng: -75.1 };
const OFFICE: Pick<Observation, 'lat' | 'lng'> = { lat: 40.2, lng: -75.4 };

function at(minutes: number): Date {
  return new Date(Date.UTC(2026, 7, 13, 12, minutes, 0));
}

function parked(odometer: number, minutes: number, where = HOME): Observation {
  return {
    reachable: true,
    odometer,
    shiftState: 'P',
    observedAt: at(minutes),
    ...where,
  };
}

function driving(odometer: number, minutes: number): Observation {
  return {
    reachable: true,
    odometer,
    shiftState: 'D',
    observedAt: at(minutes),
    lat: 40.15,
    lng: -75.25,
  };
}

const unreachable: Observation = {
  reachable: false,
  odometer: null,
  lat: null,
  lng: null,
  shiftState: null,
  observedAt: at(0),
};

const fresh: PollState = {
  anchorOdometer: null,
  anchorLat: null,
  anchorLng: null,
  anchorAt: null,
  tripStartedAt: null,
  lastShiftState: null,
};

describe('isParked', () => {
  it.each([['P'], [null]])('treats %s as parked', (gear) => {
    expect(isParked(gear)).toBe(true);
  });

  it.each([['D'], ['R'], ['N']])('treats %s as moving', (gear) => {
    expect(isParked(gear)).toBe(false);
  });
});

describe('decide', () => {
  it('sets an anchor on first sighting without inventing a drive', () => {
    const { drive, state } = decide(fresh, parked(1000, 0));
    expect(drive).toBeNull();
    expect(state.anchorOdometer).toBe(1000);
    expect(state.anchorAt).toEqual(at(0));
  });

  it('records nothing while the car sits still', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    expect(decide(anchored, parked(1000, 10)).drive).toBeNull();
  });

  it('ignores sub-threshold odometer noise', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    expect(decide(anchored, parked(1000.05, 10)).drive).toBeNull();
  });

  it('detects a drive between two parked sightings', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    const { drive } = decide(anchored, parked(1012.4, 30, OFFICE));

    expect(drive).not.toBeNull();
    expect(drive?.distanceMiles).toBe(12.4);
    expect(drive?.startOdometer).toBe(1000);
    expect(drive?.endOdometer).toBe(1012.4);
    expect(drive?.startLat).toBe(HOME.lat);
    expect(drive?.endLat).toBe(OFFICE.lat);
  });

  it('leaves duration null when departure was never observed', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    const { drive } = decide(anchored, parked(1010, 30, OFFICE));
    expect(drive?.durationSec).toBeNull();
    // Falls back to the anchor time rather than guessing a departure.
    expect(drive?.startedAt).toEqual(at(0));
  });

  it('times the drive when departure was observed', () => {
    let state = decide(fresh, parked(1000, 0)).state;
    state = decide(state, driving(1002, 10)).state;
    const { drive } = decide(state, parked(1010, 25, OFFICE));

    expect(drive?.startedAt).toEqual(at(10));
    expect(drive?.durationSec).toBe(15 * 60);
  });

  it('holds the anchor while in gear so the origin survives', () => {
    let state = decide(fresh, parked(1000, 0)).state;
    state = decide(state, driving(1005, 10)).state;
    expect(state.anchorOdometer).toBe(1000);
    expect(state.anchorLat).toBe(HOME.lat);
  });

  it('keeps the first departure time across several driving polls', () => {
    let state = decide(fresh, parked(1000, 0)).state;
    state = decide(state, driving(1002, 10)).state;
    state = decide(state, driving(1006, 12)).state;
    expect(state.tripStartedAt).toEqual(at(10));
  });

  it('still finds the drive when every mid-drive poll is missed', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    // Car slept through the whole trip and is only seen again at the far end.
    const asleep = decide(anchored, unreachable).state;
    const { drive } = decide(asleep, parked(1042, 90, OFFICE));

    expect(drive?.distanceMiles).toBe(42);
    expect(drive?.startLat).toBe(HOME.lat);
    expect(drive?.endLat).toBe(OFFICE.lat);
  });

  it('never treats an unreachable car as parked', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    const decision = decide(anchored, unreachable);
    expect(decision.drive).toBeNull();
    expect(decision.state).toEqual(anchored);
    expect(decision.intervalMs).toBe(POLL_INTERVALS_MS.unreachable);
  });

  it('re-anchors without a drive if the odometer goes backwards', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    const { drive, state } = decide(anchored, parked(20, 10));
    expect(drive).toBeNull();
    expect(state.anchorOdometer).toBe(20);
  });

  it('holds the anchor when parked but the odometer is missing', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    const { drive, state } = decide(anchored, {
      ...parked(1000, 10),
      odometer: null,
    });
    expect(drive).toBeNull();
    expect(state.anchorOdometer).toBe(1000);
  });

  it('splits a multi-stop day into one drive per stop', () => {
    let state = decide(fresh, parked(1000, 0)).state;

    const first = decide(state, parked(1010, 30, OFFICE));
    state = first.state;
    const second = decide(state, parked(1025, 120, HOME));

    expect(first.drive?.distanceMiles).toBe(10);
    expect(second.drive?.distanceMiles).toBe(15);
    expect(second.drive?.startOdometer).toBe(1010);
  });

  it('polls faster while driving than while parked', () => {
    const anchored = decide(fresh, parked(1000, 0)).state;
    expect(decide(anchored, driving(1001, 5)).intervalMs).toBe(
      POLL_INTERVALS_MS.driving,
    );
    expect(decide(anchored, parked(1000, 5)).intervalMs).toBe(
      POLL_INTERVALS_MS.parked,
    );
  });
});
