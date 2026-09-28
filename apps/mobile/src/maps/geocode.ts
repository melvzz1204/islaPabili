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
