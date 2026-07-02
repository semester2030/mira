import * as fs from 'fs';
import * as path from 'path';

export interface ColorCatalogEntry {
  id: string;
  name: string;
  nameAr: string;
  hex: string;
  lab: [number, number, number];
}

export interface ProfessionalColorMatch {
  id: string;
  nameAr: string;
  displayNameAr: string;
  hex: string;
  deltaE: number;
  confidence: number;
  matchTierAr: string;
  shadeAr: string;
}

type ColorsJson = {
  colors?: Record<
    string,
    {
      name?: string;
      nameAr?: string;
      hex?: string;
      lab?: number[];
    }
  >;
};

let catalog: ColorCatalogEntry[] | null = null;

function repoRoot(): string {
  return path.resolve(__dirname, '../../../..');
}

export function loadColorCatalog(rootDir = repoRoot()): ColorCatalogEntry[] {
  if (catalog) return catalog;
  const colorsPath = path.join(rootDir, 'assets/fashion/colors.json');
  const raw = JSON.parse(fs.readFileSync(colorsPath, 'utf8')) as ColorsJson;
  catalog = Object.entries(raw.colors ?? {}).map(([id, c]) => ({
    id,
    name: c.name ?? id,
    nameAr: c.nameAr ?? id,
    hex: c.hex ?? '#888888',
    lab: [c.lab?.[0] ?? 0, c.lab?.[1] ?? 0, c.lab?.[2] ?? 0],
  }));
  return catalog;
}

export function resetColorCatalogCache(): void {
  catalog = null;
}

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750;
  const z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041;

  const f = (t: number) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116);

  const fx = f(x / 0.95047);
  const fy = f(y / 1.0);
  const fz = f(z / 1.08883);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE2000(lab1: [number, number, number], lab2: [number, number, number]): number {
  const [l1, a1, b1] = lab1;
  const [l2, a2, b2] = lab2;

  const avgL = (l1 + l2) * 0.5;
  const c1 = Math.sqrt(a1 * a1 + b1 * b1);
  const c2 = Math.sqrt(a2 * a2 + b2 * b2);
  const avgC = (c1 + c2) * 0.5;

  const g = 0.5 * (1 - Math.sqrt(Math.pow(avgC, 7) / (Math.pow(avgC, 7) + Math.pow(25, 7))));

  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;

  const c1p = Math.sqrt(a1p * a1p + b1 * b1);
  const c2p = Math.sqrt(a2p * a2p + b2 * b2);
  const avgCp = (c1p + c2p) * 0.5;

  let h1p = (Math.atan2(b1, a1p) * 180) / Math.PI;
  if (h1p < 0) h1p += 360;
  let h2p = (Math.atan2(b2, a2p) * 180) / Math.PI;
  if (h2p < 0) h2p += 360;

  let deltahp = h2p - h1p;
  if (deltahp > 180) deltahp -= 360;
  if (deltahp < -180) deltahp += 360;

  const deltaLp = l2 - l1;
  const deltaCp = c2p - c1p;
  const deltaHp = 2 * Math.sqrt(c1p * c2p) * Math.sin((deltahp * Math.PI) / 180 / 2);

  let avgHp = (h1p + h2p) * 0.5;
  if (Math.abs(h1p - h2p) > 180) avgHp += h1p + h2p < 360 ? 180 : -180;

  const t =
    1 -
    0.17 * Math.cos(((avgHp - 30) * Math.PI) / 180) +
    0.24 * Math.cos((2 * avgHp * Math.PI) / 180) +
    0.32 * Math.cos(((3 * avgHp + 6) * Math.PI) / 180) -
    0.2 * Math.cos(((4 * avgHp - 63) * Math.PI) / 180);

  const sl = 1 + (0.015 * Math.pow(avgL - 50, 2)) / Math.sqrt(20 + Math.pow(avgL - 50, 2));
  const sc = 1 + 0.045 * avgCp;
  const sh = 1 + 0.015 * avgCp * t;

  const deltaTheta = 30 * Math.exp(-Math.pow((avgHp - 275) / 25, 2));
  const rc = 2 * Math.sqrt(Math.pow(avgCp, 7) / (Math.pow(avgCp, 7) + Math.pow(25, 7)));
  const rt = -rc * Math.sin((2 * deltaTheta * Math.PI) / 180);

  const termL = deltaLp / sl;
  const termC = deltaCp / sc;
  const termH = deltaHp / sh;

  return Math.sqrt(termL * termL + termC * termC + termH * termH + rt * termC * termH);
}

function shadeFromLab(detected: [number, number, number], reference: [number, number, number]): string {
  const dl = detected[0] - reference[0];
  if (dl > 14) return 'أفتح من المرجع';
  if (dl > 6) return 'فاتح';
  if (dl < -14) return 'أغمق من المرجع';
  if (dl < -6) return 'غامق';
  return 'متوسط';
}

function tierFromDeltaE(de: number): string {
  if (de < 2.5) return 'تطابق دقيق';
  if (de < 5) return 'تطابق عالٍ';
  if (de < 10) return 'تطابق جيد';
  if (de < 18) return 'قريب';
  return 'تقريبي';
}

function confidenceFromDeltaE(de: number): number {
  if (de < 2.5) return 0.98;
  if (de < 5) return 0.93;
  if (de < 10) return 0.86;
  if (de < 18) return 0.72;
  if (de < 28) return 0.58;
  return 0.42;
}

function applyGrayWorld(
  r: number,
  g: number,
  b: number,
  avgR: number,
  avgG: number,
  avgB: number,
  strength = 0.55,
): [number, number, number] {
  const gray = (avgR + avgG + avgB) / 3;
  if (avgR < 8 || avgG < 8 || avgB < 8) return [r, g, b];
  const sr = 1 + (gray / avgR - 1) * strength;
  const sg = 1 + (gray / avgG - 1) * strength;
  const sb = 1 + (gray / avgB - 1) * strength;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return [clamp(r * sr), clamp(g * sg), clamp(b * sb)];
}

export function isSpecularHighlight(r: number, g: number, b: number): boolean {
  const lum = r * 0.299 + g * 0.587 + b * 0.114;
  const maxC = Math.max(r, g, b);
  const minC = Math.min(r, g, b);
  const spread = maxC - minC;
  if (lum > 225 && spread < 28) return true;
  if (lum > 200 && spread < 14) return true;
  return false;
}

export function matchRgb(
  r: number,
  g: number,
  b: number,
  opts?: { avgR?: number; avgG?: number; avgB?: number },
): ProfessionalColorMatch {
  const entries = loadColorCatalog();
  const [cr, cg, cb] =
    opts?.avgR != null && opts?.avgG != null && opts?.avgB != null
      ? applyGrayWorld(r, g, b, opts.avgR, opts.avgG, opts.avgB)
      : [r, g, b];

  const lab = rgbToLab(cr, cg, cb);

  let best = entries[0];
  let bestDe = Number.POSITIVE_INFINITY;

  for (const entry of entries) {
    const de = deltaE2000(lab, entry.lab);
    if (de < bestDe) {
      bestDe = de;
      best = entry;
    }
  }

  const shade = shadeFromLab(lab, best.lab);
  return {
    id: best.id,
    nameAr: best.nameAr,
    displayNameAr: `${best.nameAr} ${shade}`,
    hex: best.hex,
    deltaE: bestDe,
    confidence: confidenceFromDeltaE(bestDe),
    matchTierAr: tierFromDeltaE(bestDe),
    shadeAr: shade,
  };
}
