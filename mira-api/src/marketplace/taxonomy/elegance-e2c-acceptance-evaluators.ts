/** Pure acceptance checks; no business writes and no UI mutation. */
export function evaluateFullServiceLayout(p: {
  formRoles?: string[];
  advancedRoles?: string[];
  advancedOpen?: boolean;
}): { ok: boolean; reason?: string } {
  const expected = ['compose', 'advanced', 'preview-publish', 'editor-actions'];
  if (!Array.isArray(p.formRoles) || JSON.stringify(p.formRoles) !== JSON.stringify(expected)) {
    return { ok: false, reason: 'full form sections do not follow the approved order' };
  }
  if (JSON.stringify(p.advancedRoles) !== JSON.stringify(['detail-media', 'details', 'commerce'])) {
    return { ok: false, reason: 'secondary sections missing or outside the advanced fold' };
  }
  return p.advancedOpen === false
    ? { ok: true }
    : { ok: false, reason: 'advanced fold is open or missing' };
}

/** Semantic comparison: row order may change, but no row/value may disappear. */
export function compareAvailabilitySnapshot(expected: unknown, actual: unknown): {
  ok: boolean; reason?: string;
} {
  function canonical(value: any): string {
    const doc = value?.availability;
    if (!doc || doc.v !== 2 || typeof doc.timezone !== 'string' || !doc.timezone ||
        !Array.isArray(doc.windows) || !Array.isArray(doc.exceptions) || !Array.isArray(doc.closedDates) ||
        !Object.prototype.hasOwnProperty.call(value, 'placeMode') ||
        !Object.prototype.hasOwnProperty.call(value, 'branchId')) {
      throw new Error('incomplete availability snapshot');
    }
    if (value.placeMode != null && typeof value.placeMode !== 'string') {
      throw new Error('incomplete availability snapshot');
    }
    const number = (n: unknown, min: number, max: number): number => {
      if (typeof n !== 'number' || !Number.isInteger(n) || n < min || n > max) {
        throw new Error('invalid numeric value in snapshot');
      }
      return n;
    };
    const resource = (n: unknown) => {
      if (n == null || n === '') return '';
      if (typeof n !== 'string') throw new Error('invalid resource id');
      return n;
    };
    const date = (d: unknown) => {
      if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('invalid date');
      return d;
    };
    const period = (w: any) => {
      const start = number(w.startMin, 0, 1439), end = number(w.endMin, 1, 1440);
      if (end <= start) throw new Error('invalid time range');
      return [start, end, number(w.capacity, 1, 100), resource(w.resourceId)];
    };
    const sortRows = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).sort();
    const windows = sortRows(doc.windows.map((w: any) => [number(w.weekday, 0, 6), ...period(w)]));
    const exceptions = sortRows(doc.exceptions.map((e: any) => {
      if (e.kind === 'closed') return [date(e.date), 'closed', resource(e.resourceId)];
      if (e.kind === 'special') return [date(e.date), 'special', ...period(e)];
      throw new Error('invalid exception kind');
    }));
    if (value.branchId != null && typeof value.branchId !== 'string') throw new Error('invalid branch');
    const placeMode = value.placeMode == null || value.placeMode === ''
      ? ''
      : String(value.placeMode);
    if (typeof value.placeMode !== 'string' && value.placeMode != null) {
      throw new Error('invalid place mode');
    }
    return JSON.stringify({
      v: doc.v, timezone: doc.timezone, windows, exceptions,
      closedDates: doc.closedDates.map(date).sort(),
      placeMode, branchId: value.branchId || null,
    });
  }
  try {
    return canonical(expected) === canonical(actual)
      ? { ok: true }
      : { ok: false, reason: 'availability or location differs from the pre-save snapshot' };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : 'invalid snapshot' };
  }
}

export function evaluateComposeFieldOrder(payload: {
  fieldRoles: string[];
  sideRoles: string[];
}): { ok: boolean; reason?: string } {
  const expectedFields = ['service-orbs', 'basics', 'place', 'template', 'secondary'];
  const present = expectedFields.filter((r) => payload.fieldRoles.includes(r));
  for (let i = 0; i < present.length; i++) {
    if (payload.fieldRoles[i] !== present[i]) {
      return { ok: false, reason: `fields order ${payload.fieldRoles.join('>')} ≠ ${present.join('>')}` };
    }
  }
  const availIdx = payload.sideRoles.indexOf('availability');
  const mediaIdx = payload.sideRoles.findIndex((r) => r === 'main-media' || r === 'media');
  // Preview (main-media) must come before availability so the card sits beside basics.
  if (availIdx >= 0 && mediaIdx >= 0 && mediaIdx > availIdx) {
    return { ok: false, reason: 'media after availability' };
  }
  return { ok: present.length >= 2 };
}

/** Desktop geometry: orbs/fields first; real preview card beside fields (not media column shell alone). */
export function evaluateDesktopGeometry(g: {
  orbsTop?: number;
  basicsTop?: number;
  fieldsLeft?: number;
  fieldsRight?: number;
  mediaLeft?: number;
  mediaRight?: number;
  previewLeft?: number;
  previewRight?: number;
  previewTop?: number;
  availTop?: number;
  mediaTop?: number;
  secondaryOpen?: boolean | null;
  exceptionsOpen?: boolean | null;
  weeklyEditOpen?: boolean | null;
  viewportWidth?: number;
  sideBySidePx?: number;
  fieldsWidth?: number;
  mediaWidth?: number;
  previewWidth?: number;
  measuredPreview?: boolean;
}): { ok: boolean; reason?: string } {
  // Missing/null/NaN measurements are evidence gaps, never a successful layout.
  const required = ['viewportWidth', 'previewTop', 'basicsTop', 'fieldsLeft', 'previewLeft',
    'previewWidth', 'fieldsWidth'] as const;
  for (const key of required) {
    if (typeof g[key] !== 'number' || !Number.isFinite(g[key]) || g[key]! < 0) {
      return { ok: false, reason: `missing or invalid geometry: ${key}` };
    }
  }
  if (!g.viewportWidth || !g.previewWidth || !g.fieldsWidth || g.measuredPreview !== true) {
    return { ok: false, reason: 'non-visible geometry or preview not measured' };
  }
  const w = g.viewportWidth;
  const previewLeft = Number(
    Number.isFinite(Number(g.previewLeft)) ? g.previewLeft : g.mediaLeft,
  );
  const sep = Number(
    g.sideBySidePx ?? Math.abs(Number(g.fieldsLeft) - previewLeft),
  );
  if (w >= 1000) {
    if (g.measuredPreview !== true) {
      return { ok: false, reason: 'preview card bounds missing (not e2c-editor-media shell)' };
    }
    // RTL/LTR: fields vs actual preview card must be side-by-side.
    if (sep < 120) return { ok: false, reason: `not side-by-side sep=${sep}` };
    if (Number.isFinite(Number(g.orbsTop)) && Number.isFinite(Number(g.basicsTop))) {
      if (Number(g.orbsTop) > Number(g.basicsTop) + 40) {
        return { ok: false, reason: 'orbs below basics' };
      }
    }
    // Preview may sit near orbs (media column top). Fail only if the card drops well below basics.
    if (Number.isFinite(Number(g.previewTop)) && Number.isFinite(Number(g.basicsTop))) {
      if (Number(g.previewTop) > Number(g.basicsTop) + 280) {
        return {
          ok: false,
          reason: `preview dropped far below basics previewTop=${g.previewTop} basicsTop=${g.basicsTop}`,
        };
      }
    }
    // Availability stacks under the media stage in the same side column (media-first layout).
    if (Number.isFinite(Number(g.availTop)) && Number.isFinite(Number(g.mediaTop))) {
      if (Number(g.availTop) + 40 < Number(g.mediaTop)) {
        return { ok: false, reason: 'availability above media stage' };
      }
    }
    // Preview card must sit in the media column horizontally (beside fields).
    if (Number.isFinite(Number(g.mediaLeft)) && Number.isFinite(previewLeft)) {
      if (Math.abs(Number(g.mediaLeft) - previewLeft) > 80) {
        return { ok: false, reason: 'preview card not in media column' };
      }
    }
  }
  if (g.secondaryOpen === true) return { ok: false, reason: 'secondary details should start collapsed' };
  if (g.exceptionsOpen === true) return { ok: false, reason: 'exceptions details should start collapsed' };
  if (g.weeklyEditOpen === true) return { ok: false, reason: 'weekly edit details should start collapsed' };
  if (!(Number(g.fieldsLeft) >= 0 && previewLeft >= 0)) {
    return { ok: false, reason: 'missing fields/preview boxes' };
  }
  return { ok: true };
}

