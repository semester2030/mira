/** Display riyals from stored halalas. Null means the price is absent, not zero. */
export function formatCatalogPrice(halalas: number | null | undefined): string | null {
  if (halalas == null || typeof halalas !== 'number' || !Number.isFinite(halalas)) return null;
  const sign = halalas < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(halalas));
  const riyals = Math.floor(abs / 100);
  const fraction = abs % 100;
  const body = fraction === 0 ? `${riyals}` : `${riyals}.${fraction.toString().padStart(2, '0')}`;
  return `${sign}${body} ر.س`;
}
