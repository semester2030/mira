/** Pure R2 acceptance judgment — SDK success alone never yields PASS. */
import { createHash } from 'node:crypto';

export const REQUIRED_MIRA_STEPS = [
  'R2_MIRA_CREATE_SESSION',
  'R2_MIRA_SIGN_PARTS',
  'R2_MIRA_BROWSER_PUT',
  'R2_MIRA_COMPLETE',
  'R2_MIRA_READY',
  'R2_MIRA_BIND',
  'R2_MIRA_PUBLISH',
  'R2_MIRA_READ_FULL',
  'R2_MIRA_READ_RANGE',
  'R2_MIRA_ABORT_READ',
] as const;

export type R2Step = { id: string; ok: boolean | 'BLOCKED' };

export function judgeR2Acceptance(steps: R2Step[]): {
  ok: boolean;
  blocked: boolean;
  failed: string[];
  detail: string;
} {
  const failed = steps.filter((s) => s.ok === false).map((s) => s.id);
  const miraBlocked = steps.some((s) => s.id === 'R2_MIRA_APP_PATH' && s.ok === 'BLOCKED');
  const miraGateFail = steps.some((s) => s.id === 'R2_MIRA_APP_PATH' && s.ok === false);
  const miraOk = REQUIRED_MIRA_STEPS.every((id) => steps.some((s) => s.id === id && s.ok === true));
  const sdkOk = steps.some((s) => s.id === 'R2_SUITE' && s.ok === true);

  if (miraBlocked && failed.length === 0 && !miraGateFail) {
    return { ok: false, blocked: true, failed, detail: 'MIRA_APP_PATH_BLOCKED' };
  }
  if (!miraOk || miraGateFail || failed.length > 0 || !sdkOk) {
    return {
      ok: false,
      blocked: false,
      failed: [...failed, ...(miraOk ? [] : ['MIRA_STEPS_INCOMPLETE'])],
      detail: miraOk ? 'FAILED_STEPS' : 'MIRA_STEPS_INCOMPLETE_OR_SDK_ONLY',
    };
  }
  return { ok: true, blocked: false, failed: [], detail: 'PASS' };
}

/** Extract READY media id from publicSession / session GET body (catalogMediaId is the contract). */
export function mediaIdFromSessionBody(body: {
  status?: string;
  catalogMediaId?: string | null;
  mediaId?: string | null;
  session?: { status?: string; catalogMediaId?: string | null };
}): string | null {
  const status = String(body?.status || body?.session?.status || '').toLowerCase();
  if (status !== 'ready') return null;
  const id = body?.catalogMediaId || body?.session?.catalogMediaId || null;
  // Intentionally ignore legacy body.mediaId — not the publicSession contract.
  return id ? String(id) : null;
}

/** Bind success: HTTP ok AND final ownership/primary state matches, OR documented idempotent already-primary. */
export function judgeBindResult(input: {
  httpOk: boolean;
  status: number;
  mediaId: string;
  ownerId: string;
  /** Final media row after bind attempt */
  final?: { id?: string; ownerId?: string; isPrimary?: boolean; draftIsPrimary?: boolean | null } | null;
}): { ok: boolean; reason: string } {
  if (!input.mediaId || !input.ownerId) return { ok: false, reason: 'missing-ids' };
  if (input.status === 409) {
    // 409 alone is never success — require final state proving intended media is primary for owner.
    const f = input.final;
    if (
      f &&
      f.id === input.mediaId &&
      f.ownerId === input.ownerId &&
      (f.isPrimary === true || f.draftIsPrimary === true)
    ) {
      return { ok: true, reason: 'idempotent-already-primary-verified' };
    }
    return { ok: false, reason: 'http-409-without-verified-final-state' };
  }
  if (!input.httpOk) return { ok: false, reason: `http-${input.status}` };
  const f = input.final;
  if (!f || f.id !== input.mediaId || f.ownerId !== input.ownerId) {
    return { ok: false, reason: 'final-owner-mismatch' };
  }
  if (!(f.isPrimary === true || f.draftIsPrimary === true)) {
    return { ok: false, reason: 'not-primary-after-bind' };
  }
  return { ok: true, reason: 'bound' };
}

export function judgeRangeResponse(input: {
  status: number;
  contentRange: string | null;
  contentLengthHeader: string | null;
  body: Buffer;
  expectedFile: Buffer;
  start: number;
  end: number; // inclusive
}): { ok: boolean; reason: string } {
  const expectLen = input.end - input.start + 1;
  if (input.status !== 206) return { ok: false, reason: `status-${input.status}` };
  const cr = String(input.contentRange || '');
  const expectCr = `bytes ${input.start}-${input.end}/${input.expectedFile.length}`;
  if (cr !== expectCr) return { ok: false, reason: `content-range-mismatch got=${cr}` };
  const cl = Number(input.contentLengthHeader);
  if (cl !== expectLen) return { ok: false, reason: `content-length-mismatch got=${input.contentLengthHeader}` };
  if (input.body.length !== expectLen) return { ok: false, reason: `body-len-${input.body.length}` };
  const slice = input.expectedFile.subarray(input.start, input.end + 1);
  if (!input.body.equals(slice)) return { ok: false, reason: 'body-bytes-mismatch' };
  // Reject JSON/HTML error bodies disguised as success
  const head = input.body.subarray(0, Math.min(16, input.body.length)).toString('utf8');
  if (/^\s*[\{\[<]/.test(head) && !slice.equals(input.body)) {
    return { ok: false, reason: 'looks-like-error-document' };
  }
  return { ok: true, reason: 'range-ok' };
}

export function judgeFullRead(input: {
  status: number;
  body: Buffer;
  expected: Buffer;
  expectedSha256: string;
}): { ok: boolean; reason: string } {
  if (!(input.status >= 200 && input.status < 300)) return { ok: false, reason: `status-${input.status}` };
  if (input.body.length !== input.expected.length) return { ok: false, reason: 'length-mismatch' };
  const got = createHash('sha256').update(input.body).digest('hex');
  if (got !== input.expectedSha256) return { ok: false, reason: 'sha-mismatch' };
  return { ok: true, reason: 'full-ok' };
}
