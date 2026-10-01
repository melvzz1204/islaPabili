import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { useAuth } from '@isla/supabase';

/**
 * Broadcasts the rider's GPS while they have an active delivery:
 * - `rider_status.current_lat/lng` on every fix (drives the customer map)
 * - `rider_locations` row at most once a minute (durable trail)
 *
 * Mount with `enabled = hasActiveDelivery`. Best-effort: a denied GPS
 * permission simply leaves the map on the last pinned position.
 */
export function useRiderBroadcast(enabled: boolean) {
  const { client, profile } = useAuth();
  const [broadcasting, setBroadcasting] = useState(false);
  const lastTrail = useRef(0);

  useEffect(() => {
    if (!enabled || !profile) {
      setBroadcasting(false);
      return;
    }
    let sub: Location.LocationSubscription | null = null;
    let cancelled = false;

    void (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (!perm.granted || cancelled) return;
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 20_000,
            distanceInterval: 25,
          },
          (pos) => {
            if (cancelled) return;
            const { latitude, longitude } = pos.coords;
            setBroadcasting(true);
            void client
              .from('rider_status')
              .update({
                current_lat: latitude,
                current_lng: longitude,
                last_seen_at: new Date().toISOString(),
              })
              .eq('rider_id', profile.id);
            // Durable trail, throttled to one row per minute.
            if (Date.now() - lastTrail.current > 60_000) {
              lastTrail.current = Date.now();
              void client.from('rider_locations').insert({ rider_id: profile.id, lat: latitude, lng: longitude });
            }
          },
        );
      } catch {
        // GPS unavailable, customer map falls back to the last pin.
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [client, profile, enabled]);

  return { broadcasting };
}
