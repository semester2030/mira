import citiesJson from './saudi-cities.json';

export type SaudiCity = {
  id: string;
  nameAr: string;
  nameEn: string;
  lat: number;
  lng: number;
};

export const SAUDI_CITIES: SaudiCity[] = citiesJson as SaudiCity[];

const byId = new Map(SAUDI_CITIES.map((c) => [c.id, c]));
const byNameAr = new Map(SAUDI_CITIES.map((c) => [c.nameAr, c]));

export function listSaudiCities(q?: string): SaudiCity[] {
  const needle = String(q || '')
    .trim()
    .toLowerCase();
  if (!needle) return SAUDI_CITIES.slice();
  return SAUDI_CITIES.filter(
    (c) =>
      c.id.toLowerCase().includes(needle) ||
      c.nameAr.includes(needle) ||
      c.nameEn.toLowerCase().includes(needle),
  );
}

export function resolveSaudiCity(idOrName: string | null | undefined): SaudiCity | null {
  const raw = String(idOrName || '').trim();
  if (!raw) return null;
  return byId.get(raw) || byNameAr.get(raw) || null;
}

/** Approximate great-circle distance in km (WGS84 sphere). */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
