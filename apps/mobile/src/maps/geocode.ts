export type NominatimResult = {
  display_name: string;
  lat: string;
  lon: string;
};

/**
 * Free OpenStreetMap search (Nominatim). Biased to Marinduque, PH so
 * barangay/town names resolve locally first. No API key needed.
 */
export async function searchPlaces(query: string): Promise<NominatimResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: `${q}, Marinduque, Philippines`,
    addressdetails: '0',
    limit: '5',
    countrycodes: 'ph',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) return [];
  const rows = (await res.json()) as NominatimResult[];
  return Array.isArray(rows) ? rows : [];
}

/**
 * Keep the most local parts of a Nominatim display_name
 * ("123 Lane, Poblacion, Boac, Marinduque, ... Philippines" →
 * "123 Lane, Poblacion, Boac, Marinduque"). Short enough to show + edit.
 */
export function shortenPlaceName(display: string): string {
  const parts = display
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);
  const cleaned = parts.filter((p) => !/^\d{4,}$/.test(p) && !/^philippines$/i.test(p));
  return cleaned.slice(0, 4).join(', ') || display;
}

/** Coordinates → readable address (Nominatim reverse). Empty string on failure. */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
      addressdetails: '0',
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return '';
    const row = (await res.json()) as { display_name?: string };
    return row.display_name ? shortenPlaceName(row.display_name) : '';
  } catch {
    return '';
  }
}
