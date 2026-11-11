import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type JewelryAdminFlags = {
  allowSilverGoldPlated: boolean;
  allowLabDiamond: boolean;
};

export type JewelryMaterialPolicy = {
  schemaVersion: number;
  definitionsVersion: number;
  allowedBaseMetals: string[];
  rejectedBaseMetals: string[];
  goldFilterMetals: string[];
  silverFilterMetals: string[];
  adminFlags: Record<string, { default: boolean; labelAr: string }>;
  diamondKinds: Record<string, { labelAr: string; countsAsDiamond: boolean; requiresFlag?: string }>;
  outOfScope: string[];
  saudiHallmarkSource: string | null;
  saudiHallmarkVerifiedAt: string | null;
  saudiHallmarkNoteAr: string;
};

const HERE = __dirname;

let cached: JewelryMaterialPolicy | null = null;

export function loadJewelryMaterialPolicy(): JewelryMaterialPolicy {
  if (cached) return cached;
  const raw = JSON.parse(
    readFileSync(join(HERE, 'jewelry-material-policy.v1.json'), 'utf8'),
  ) as JewelryMaterialPolicy;
  cached = raw;
  return raw;
}

/** Default admin flags — never silently enable plated silver or lab diamond. */
export function defaultJewelryAdminFlags(): JewelryAdminFlags {
  const p = loadJewelryMaterialPolicy();
  return {
    allowSilverGoldPlated: p.adminFlags.allowSilverGoldPlated?.default === true,
    allowLabDiamond: p.adminFlags.allowLabDiamond?.default === true,
  };
}

export type JewelryPolicyViolation = {
  code: string;
  messageAr: string;
  fieldId?: string;
};

/**
 * Server material gate for jewelry drafts/publish.
 * steel/brass/copper/unknown/other rejected as base metal even if gold-plated.
 * silver_gold_plated is silver-only for filters; requires allowSilverGoldPlated.
 * Lab diamond requires allowLabDiamond; moissanite/CZ never count as diamond.
 */
export function assertJewelryMaterialPolicy(
  attrs: Record<string, unknown> | null | undefined,
  flags: JewelryAdminFlags = defaultJewelryAdminFlags(),
): JewelryPolicyViolation[] {
  const p = loadJewelryMaterialPolicy();
  const out: JewelryPolicyViolation[] = [];
  const metal = attrs?.metal != null ? String(attrs.metal) : '';
  if (!metal) return out;

  if (p.rejectedBaseMetals.includes(metal) || !p.allowedBaseMetals.includes(metal)) {
    out.push({
      code: 'JEWELRY_METAL_REJECTED',
      fieldId: 'metal',
      messageAr:
        'المعدن الأساسي غير مقبول في ميرا (الستيل والنحاس والبراس والمعادن المجهولة مرفوضة حتى لو كانت مطلية)',
    });
  }

  if (metal === 'silver_gold_plated' && !flags.allowSilverGoldPlated) {
    out.push({
      code: 'JEWELRY_PLATED_SILVER_DISABLED',
      fieldId: 'metal',
      messageAr: 'فضة مطلية بالذهب غير مفعّلة إداريًا — تُصنَّف فضة مطلية فقط ولا تدخل فلتر الذهب',
    });
  }

  const origin = attrs?.diamondOrigin != null ? String(attrs.diamondOrigin) : '';
  if (origin === 'lab' && !flags.allowLabDiamond) {
    out.push({
      code: 'JEWELRY_LAB_DIAMOND_DISABLED',
      fieldId: 'diamondOrigin',
      messageAr: 'الألماس المختبري غير مفعّل إداريًا',
    });
  }

  const stones = Array.isArray(attrs?.stoneTypes)
    ? (attrs!.stoneTypes as unknown[]).map(String)
    : attrs?.stoneTypes
      ? [String(attrs.stoneTypes)]
      : [];
  if (stones.includes('moissanite') || stones.includes('cubic_zirconia')) {
    out.push({
      code: 'JEWELRY_FAKE_DIAMOND_LABEL',
      fieldId: 'stoneTypes',
      messageAr: 'المويسانيت والزركونيا المكعبة لا يُصنَّفان ألماسًا',
    });
  }

  return out;
}

/** Resolve partner activity grant id from metal + stones (not piece subcategory). */
export function resolveJewelryCapabilityActivity(attrs: Record<string, unknown> | null | undefined): string | null {
  const metal = attrs?.metal != null ? String(attrs.metal) : '';
  if (!metal) return null;
  const stones = Array.isArray(attrs?.stoneTypes)
    ? (attrs!.stoneTypes as unknown[]).map(String)
    : [];
  const gemstone = attrs?.gemstone != null ? String(attrs.gemstone).toLowerCase() : '';
  const hasDiamond =
    stones.includes('diamond') ||
    gemstone.includes('diamond') ||
    gemstone.includes('ألماس') ||
    gemstone.includes('الماس');
  const hasSetStones =
    hasDiamond ||
    stones.some((s) => ['emerald', 'ruby', 'sapphire', 'pearl', 'other'].includes(s));

  if (metal === 'silver' || metal === 'silver_gold_plated') {
    return metal === 'silver_gold_plated' ? 'jewelry.cap.silver_gold_plated' : 'jewelry.cap.silver';
  }
  if (metal === 'gold') {
    return hasSetStones ? 'jewelry.cap.gold_set' : 'jewelry.cap.gold';
  }
  return null;
}

/** Gold browse/filter never includes silver_gold_plated. */
export function metalMatchesGoldFilter(metal: string | null | undefined): boolean {
  const p = loadJewelryMaterialPolicy();
  return !!metal && p.goldFilterMetals.includes(String(metal));
}

export function metalMatchesSilverFilter(metal: string | null | undefined): boolean {
  const p = loadJewelryMaterialPolicy();
  return !!metal && p.silverFilterMetals.includes(String(metal));
}
