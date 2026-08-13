import { formatAddress, isCoordinateLabel } from './address-format';

describe('isCoordinateLabel', () => {
  it.each([
    ['Start (40.7128, -74.0060)'],
    ['End (40.7128, -74.0060)'],
    ['Location (-33.8688, 151.2093)'],
  ])('recognises the placeholder %s', (label) => {
    expect(isCoordinateLabel(label)).toBe(true);
  });

  it.each([
    ['123 Main St, Doylestown'],
    // Hand-entered addresses must never be treated as placeholders.
    ['Client office, 40.7128 north of the bridge'],
    ['Start of the driveway'],
    ['Wegmans'],
  ])('leaves real text alone: %s', (label) => {
    expect(isCoordinateLabel(label)).toBe(false);
  });

  it('treats null and empty as not a placeholder', () => {
    expect(isCoordinateLabel(null)).toBe(false);
    expect(isCoordinateLabel('')).toBe(false);
  });
});

describe('formatAddress', () => {
  it('uses street number and road for a plain address', () => {
    // Real Nominatim output for a house: name is an empty string, not absent.
    expect(
      formatAddress({
        name: '',
        address: {
          house_number: '159',
          road: 'Cardinal Road',
          village: 'Chalfont',
          county: 'Bucks County',
          state: 'Pennsylvania',
        },
      }),
    ).toBe('159 Cardinal Road, Chalfont');
  });

  it('prefers a business name over its street number', () => {
    expect(
      formatAddress({
        name: 'Wegmans',
        address: {
          house_number: '1000',
          road: 'Easton Road',
          town: 'Warrington',
        },
      }),
    ).toBe('Wegmans, Warrington');
  });

  it('keeps only the first of several house numbers', () => {
    expect(
      formatAddress({
        address: {
          house_number: '20;28',
          road: 'East State Street',
          town: 'Doylestown',
        },
      }),
    ).toBe('20 East State Street, Doylestown');
  });

  it('uses the road when there is no number and no name', () => {
    expect(
      formatAddress({
        address: { road: 'Easton Road', village: 'Plumsteadville' },
      }),
    ).toBe('Easton Road, Plumsteadville');
  });

  it('does not repeat a suburb used as both name and locality', () => {
    expect(formatAddress({ address: { suburb: 'Chelsea' } })).toBe('Chelsea');
  });

  it('walks the locality fallbacks in order of specificity', () => {
    expect(
      formatAddress({
        address: { road: 'Mill Road', county: 'Bucks County' },
      }),
    ).toBe('Mill Road, Bucks County');
  });

  it('trims display_name down when structured fields are absent', () => {
    expect(
      formatAddress({
        display_name: '10 Downing Street, Westminster, London, SW1A 2AA, UK',
      }),
    ).toBe('10 Downing Street, Westminster');
  });

  it('returns null when there is nothing usable', () => {
    expect(formatAddress({})).toBeNull();
    expect(formatAddress({ address: {} })).toBeNull();
  });
});
