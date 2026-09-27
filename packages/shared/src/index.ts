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

// ---------------------------------------------------------------------------
// Town preferences
//
// profiles.town_preferences is the set of municipalities a customer opted
// into. These helpers keep the "All" semantics in one place: a selection is
// "all" only when every supported town is present, and an empty selection
// means "nothing chosen yet" (never treated as "all").
// ---------------------------------------------------------------------------

/** True when every supported town is selected, i.e. the customer took "All". */
export function isAllTowns(towns: readonly Town[] | null | undefined): boolean {
  return !!towns && towns.length >= SUPPORTED_TOWNS.length && SUPPORTED_TOWNS.every((t) => towns.includes(t));
}

/** True when nothing has been selected yet. */
export function isNoTowns(towns: readonly Town[] | null | undefined): boolean {
  return !towns || towns.length === 0;
}

/** "All 6 municipalities" / "3 municipalities" / "Choose municipalities" label. */
export function townSelectionLabel(towns: readonly Town[] | null | undefined): string {
  if (isAllTowns(towns)) return 'All municipalities';
  if (isNoTowns(towns)) return 'Choose municipalities';
  return `${towns!.length} of ${SUPPORTED_TOWNS.length} municipalities`;
}

/** Toggles one town, de-duplicating and preserving SUPPORTED_TOWNS order. */
export function toggleTown(towns: readonly Town[] | null | undefined, town: Town): Town[] {
  const current = new Set(towns ?? []);
  if (current.has(town)) current.delete(town);
  else current.add(town);
  return SUPPORTED_TOWNS.filter((t) => current.has(t));
}

/** The subset of profile fields needed to resolve a customer's opted-in towns. */
export type TownPreferenceSource = {
  home_town: Town | null;
  town_preferences?: readonly Town[] | null;
};

/**
 * Resolves the towns a customer opted into, falling back to `home_town` for
 * rows written before `town_preferences` existed. Returns [] when nothing is
 * set, which callers must treat as "no filter" rather than "no results".
 */
export function resolveOptedTowns(
  profile: TownPreferenceSource | null | undefined,
): Town[] {
  if (!profile) return [];
  if (!isNoTowns(profile.town_preferences)) return [...profile.town_preferences!];
  return profile.home_town ? [profile.home_town] : [];
}

/**
 * Whether a store search should be restricted to `towns`. False for guests and
 * for customers who opted into every municipality, so browsing is unrestricted
 * in exactly those cases.
 */
export function shouldFilterTowns(towns: readonly Town[] | null | undefined): boolean {
  return !isNoTowns(towns) && !isAllTowns(towns);
}

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

// ---------------------------------------------------------------------------
// Username identity
// Usernames are the primary credential. Users without a real email sign up
// with a synthetic auth email on a reserved domain that can never receive
// mail (<username>@islapabili.internal). Login maps a username to the same
// synthetic email deterministically, so no profile lookup (and no RLS /
// privacy hole) is needed to resolve username -> email.
// ---------------------------------------------------------------------------

export const USERNAME_AUTH_DOMAIN = 'islapabili.internal';

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(input));
}

export function isReservedAuthEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${USERNAME_AUTH_DOMAIN}`);
}

/** Real email for auth, or the deterministic synthetic email for a username. */
export function authEmailForUsername(username: string): string {
  return `${normalizeUsername(username)}@${USERNAME_AUTH_DOMAIN}`;
}

/**
 * Resolve a login identifier to the Supabase auth email:
 * input containing '@' is treated as an email, otherwise as a username.
 */
export function resolveAuthEmail(login: string): string {
  const value = login.trim();
  if (value.includes('@')) return value;
  return authEmailForUsername(value);
}