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

export function normalizePhPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) {
    return '+63' + digits.slice(1);
  }
  if (digits.length === 10 && digits.startsWith('9')) {
    return '+63' + digits;
  }
  if (digits.length === 12 && digits.startsWith('63')) {
    return '+' + digits;
  }
  if (digits.length === 13 && digits.startsWith('063')) {
    return '+63' + digits.slice(3);
  }
  return null;
}

export function isValidPhPhone(input: string): boolean {
  return normalizePhPhone(input) !== null;
}

export function formatPhPhone(input: string): string {
  const normalized = normalizePhPhone(input);
  if (!normalized) return input.trim();
  return normalized;
}