export const PLATFORM_NAME = 'IslaPabili';

export const SUPPORTED_TOWNS = [
  'boac',
  'gasan',
  'mogpog',
  'santa_cruz',
  'torrijos',
  'buenavista',
] as const;

export type Town = (typeof SUPPORTED_TOWNS)[number];

export const TOWN_LABELS: Record<Town, string> = {
  boac: 'Boac',
  gasan: 'Gasan',
  mogpog: 'Mogpog',
  santa_cruz: 'Santa Cruz',
  torrijos: 'Torrijos',
  buenavista: 'Buenavista',
};

export const FARE_DEFAULTS = {
  baseFare: 40,
  baseKm: 2,
  perKmRate: 10,
} as const;