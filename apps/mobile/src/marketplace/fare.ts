import {
  FARE_FALLBACK_KM,
  TOWN_CENTERS,
  fareConfigFromDefaults,
  quoteDeliveryFee,
  type FareConfig,
  type FareQuote,
  type Town,
} from '@isla/shared';
import type { Supabase } from '@isla/supabase';
import { haversineKm } from '../lib/geo';

export type { FareQuote };
export type Gps = { lat: number; lng: number };

/** Active fare_config row; falls back to compiled defaults offline. */
export async function loadFareConfig(client: Supabase): Promise<FareConfig> {
  try {
    const { data } = await client
      .from('fare_config')
      .select('base_fare, base_km, per_km_rate, volume_tiers, peak_surge')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return fareConfigFromDefaults();
    const row = data as {
      base_fare: number | string;
      base_km: number | string;
      per_km_rate: number | string;
      volume_tiers: unknown;
      peak_surge: unknown;
    };
    return {
      base_fare: Number(row.base_fare),
      base_km: Number(row.base_km),
      per_km_rate: Number(row.per_km_rate),
      volume_tiers: row.volume_tiers,
      peak_surge: row.peak_surge,
    };
  } catch {
    return fareConfigFromDefaults();
  }
}

export type QuoteInput = {
  /** Rider start (store GPS, or town center when the shop is unknown). */
  pickup: Gps;
  /** Customer drop-off (GPS pin, or town center when unpinned). */
  dropoff: Gps;
  /** True when either endpoint is a town-center fallback. */
  estimated: boolean;
  itemCount?: number;
  config: FareConfig;
  at?: Date;
};

export function quoteTrip(input: QuoteInput): FareQuote & { estimated: boolean } {
  const distanceKm = haversineKm(input.pickup.lat, input.pickup.lng, input.dropoff.lat, input.dropoff.lng);
  return {
    ...quoteDeliveryFee({
      distanceKm,
      itemCount: input.itemCount,
      config: input.config,
      at: input.at,
    }),
    estimated: input.estimated,
  };
}

/** Straight-line estimate when the customer GPS is unknown. */
export function townFallbackQuote(town: Town, pickup: Gps, itemCount: number, config: FareConfig): FareQuote & { estimated: boolean } {
  return quoteTrip({ pickup, dropoff: TOWN_CENTERS[town], itemCount, config, estimated: true });
}

/** Legacy flat fallback (no coordinates at all). */
export function flatFallbackQuote(itemCount: number, config: FareConfig): FareQuote & { estimated: boolean } {
  return {
    ...quoteDeliveryFee({ distanceKm: FARE_FALLBACK_KM, itemCount, config }),
    estimated: true,
  };
}
