/**
 * Phase 0 — Store only redacted Perfect/YouCam audit metadata (no full raw payload by default).
 */

export interface RedactedYouCamAudit {
  capturedAt: string;
  provider: 'perfect_corp_youcam';
  hasRawPayload: false;
  outputCount?: number;
  taskKeys?: string[];
  /** Non-biometric structural hints only */
  notes: string[];
}

export function redactYouCamAudit(
  rawYouCam: unknown,
  capturedAt = new Date().toISOString(),
): RedactedYouCamAudit {
  const notes: string[] = ['Full rawYouCam omitted from persistence (Phase 0)'];
  let outputCount: number | undefined;
  let taskKeys: string[] | undefined;

  if (rawYouCam && typeof rawYouCam === 'object') {
    const obj = rawYouCam as Record<string, unknown>;
    taskKeys = Object.keys(obj).slice(0, 24);
    const results = obj.results;
    if (results && typeof results === 'object') {
      const output = (results as Record<string, unknown>).output;
      if (Array.isArray(output)) outputCount = output.length;
    }
  } else {
    notes.push('rawYouCam missing or non-object');
  }

  return {
    capturedAt,
    provider: 'perfect_corp_youcam',
    hasRawPayload: false,
    outputCount,
    taskKeys,
    notes,
  };
}

/** Serialization safety: never keep rawYouCam on stored audit. */
export function assertNoRawYouCamInAudit(audit: unknown): void {
  if (!audit || typeof audit !== 'object') return;
  if ('rawYouCam' in (audit as object)) {
    throw new Error('providerAudit must not contain rawYouCam');
  }
}
