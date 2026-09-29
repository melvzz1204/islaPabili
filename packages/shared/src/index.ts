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

/** Fallback trip length (km) when no coordinates are known yet. */
export const FARE_FALLBACK_KM = 3.2;

// ---------------------------------------------------------------------------
// Delivery quotes
//
// quoteDeliveryFee() is the single pricing rule for the app. It mirrors the
// fare_config row (base fare covers baseKm, per-km beyond that, volume tiers
// by item count / weight, optional peak-hour multiplier) so admin console
// edits take effect in every checkout without an app release.
// ---------------------------------------------------------------------------

/** Approximate poblacion coordinates per town — estimate fallback only. */
export const TOWN_CENTERS: Record<Town, { lat: number; lng: number }> = {
  boac: { lat: 13.449, lng: 121.8395 },
  gasan: { lat: 13.3197, lng: 121.8527 },
  mogpog: { lat: 13.4734, lng: 121.8616 },
  santa_cruz: { lat: 13.4833, lng: 122.0167 },
  torrijos: { lat: 13.3203, lng: 122.0827 },
  buenavista: { lat: 13.2543, lng: 121.9463 },
};

export type VolumeTier = { min_items: number; min_weight_kg: number; surcharge: number };

/** Mirrors one public.fare_config row (numbers may arrive as numeric strings). */
export type FareConfig = {
  base_fare: number;
  base_km: number;
  per_km_rate: number;
  volume_tiers?: unknown;
  peak_surge?: unknown;
};

export function fareConfigFromDefaults(): FareConfig {
  return { base_fare: FARE_DEFAULTS.baseFare, base_km: FARE_DEFAULTS.baseKm, per_km_rate: FARE_DEFAULTS.perKmRate, volume_tiers: [], peak_surge: {} };
}

const numOf = (v: unknown, fallback: number): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
};

function parseTiers(raw: unknown): VolumeTier[] {
  if (!Array.isArray(raw)) return [];
  const tiers: VolumeTier[] = [];
  for (const t of raw as Record<string, unknown>[]) {
    if (!t || typeof t !== 'object') continue;
    tiers.push({
      min_items: numOf(t.min_items, 0),
      min_weight_kg: numOf(t.min_weight_kg, 0),
      surcharge: numOf(t.surcharge, 0),
    });
  }
  return tiers;
}

/**
 * Peak multiplier from the peak_surge blob. Supports
 * `{ "multiplier": 1.25, "start_hour": 17, "end_hour": 20 }` (local hour,
 * overnight wrap allowed); anything else means no surge.
 */
export function peakMultiplierAt(raw: unknown, at: Date = new Date()): number {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return 1;
  const r = raw as Record<string, unknown>;
  const mult = numOf(r.multiplier, 1);
  if (!(mult > 1)) return 1;
  const start = numOf(r.start_hour, 0);
  const end = numOf(r.end_hour, 24);
  const h = at.getHours() + at.getMinutes() / 60;
  const inWindow = start <= end ? h >= start && h < end : h >= start || h < end;
  return inWindow ? mult : 1;
}

export type FareQuote = {
  distanceKm: number;
  baseFare: number;
  distanceFee: number;
  volumeSurcharge: number;
  surgeMultiplier: number;
  /** Whole-peso rider fee. */
  fee: number;
};

export function quoteDeliveryFee(args: {
  distanceKm: number;
  itemCount?: number;
  weightKg?: number;
  config?: FareConfig;
  at?: Date;
}): FareQuote {
  const cfg = args.config ?? fareConfigFromDefaults();
  const baseFare = numOf(cfg.base_fare, FARE_DEFAULTS.baseFare);
  const baseKm = numOf(cfg.base_km, FARE_DEFAULTS.baseKm);
  const perKm = numOf(cfg.per_km_rate, FARE_DEFAULTS.perKmRate);
  const distanceKm = Math.max(0, args.distanceKm);
  const distanceFee = Math.max(0, distanceKm - baseKm) * perKm;
  const tiers = parseTiers(cfg.volume_tiers);
  const items = args.itemCount ?? 0;
  const weight = args.weightKg ?? 0;
  let volumeSurcharge = 0;
  for (const t of tiers) {
    if ((t.min_items > 0 && items >= t.min_items) || (t.min_weight_kg > 0 && weight >= t.min_weight_kg)) {
      volumeSurcharge = Math.max(volumeSurcharge, t.surcharge);
    }
  }
  const surgeMultiplier = peakMultiplierAt(cfg.peak_surge, args.at);
  const fee = Math.max(0, Math.round((baseFare + distanceFee + volumeSurcharge) * surgeMultiplier));
  return { distanceKm, baseFare, distanceFee, volumeSurcharge, surgeMultiplier, fee };
}

/** One-line peso breakdown for receipts, e.g. "₱40 base + ₱12 · 1.2 km". */
export function fareBreakdownLabel(q: FareQuote, peso: (n: number) => string): string {
  const parts = [`${peso(q.baseFare)} base`];
  if (q.distanceFee > 0) parts.push(`+ ${peso(Math.round(q.distanceFee))} · ${q.distanceKm.toFixed(1)} km`);
  if (q.volumeSurcharge > 0) parts.push(`+ ${peso(q.volumeSurcharge)} load`);
  if (q.surgeMultiplier > 1) parts.push(`× ${q.surgeMultiplier} peak`);
  return parts.join(' ');
}

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