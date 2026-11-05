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

  // Executed failures always win over BLOCKED (cannot hide a false step under blocked).
  if (failed.length > 0 || miraGateFail) {
    return {
      ok: false,
      blocked: false,
      failed: [...failed, ...(miraGateFail ? ['R2_MIRA_APP_PATH'] : [])],
      detail: 'FAILED_STEPS',
    };
  }
  if (miraBlocked) {
    return { ok: false, blocked: true, failed: [], detail: 'MIRA_APP_PATH_BLOCKED' };
  }
  if (!miraOk || !sdkOk) {
    return {
      ok: false,
      blocked: false,
      failed: [...(miraOk ? [] : ['MIRA_STEPS_INCOMPLETE'])],
      detail: 'MIRA_STEPS_INCOMPLETE_OR_SDK_ONLY',
    };
  }
  return { ok: true, blocked: false, failed: [], detail: 'PASS' };
}

/** Abort mid-stream: must see a proper prefix, not full EOF, plus upstream close for the same request id. */
export function judgeAbortRead(input: {
  responseStatus: number;
  receivedBytes: number;
  expectedTotalBytes: number;
  abortedBeforeEof: boolean;
  upstreamClosedForRequestId: boolean;
  followUpFullOk: boolean;
}): { ok: boolean; reason: string } {
  if (!(input.responseStatus >= 200 && input.responseStatus < 300)) {
    return { ok: false, reason: `status-${input.responseStatus}` };
  }
  if (input.responseStatus === 503) return { ok: false, reason: 'error-503' };
  if (!(input.receivedBytes > 0 && input.receivedBytes < input.expectedTotalBytes)) {
    return {
      ok: false,
      reason: `bytes-not-partial got=${input.receivedBytes} total=${input.expectedTotalBytes}`,
    };
  }
  if (!input.abortedBeforeEof) return { ok: false, reason: 'not-aborted-before-eof' };
  if (!input.upstreamClosedForRequestId) return { ok: false, reason: 'upstream-close-unproven' };
  if (!input.followUpFullOk) return { ok: false, reason: 'follow-up-read-failed' };
  return { ok: true, reason: 'abort-ok' };
}

export type R2EvidenceDoc = {
  ok?: boolean;
  blocked?: boolean;
  commit?: string;
  startedUtc?: string;
  finishedUtc?: string;
  runId?: string;
  steps?: R2Step[];
};

/**
 * Authoritative evidence verifier used by REVERIFY — do not duplicate this logic in unit tests.
 */
export function verifyR2EvidenceDocument(input: {
  evidence: R2EvidenceDoc;
  testedCommit: string;
  runStartedIso: string;
  exitCode: number;
  expectedRunId?: string;
}): { verdict: 'PASS' | 'FAIL' | 'BLOCKED'; reason: string; recomputed: ReturnType<typeof judgeR2Acceptance> } {
  const ev = input.evidence || {};
  const commit = String(ev.commit || '').trim();
  const tested = String(input.testedCommit || '').trim();
  if (!commit || commit.toLowerCase() === 'unknown') {
    return {
      verdict: 'FAIL',
      reason: 'commit-missing-or-unknown',
      recomputed: { ok: false, blocked: false, failed: ['COMMIT'], detail: 'COMMIT' },
    };
  }
  if (!tested || commit !== tested) {
    return {
      verdict: 'FAIL',
      reason: 'commit-mismatch',
      recomputed: { ok: false, blocked: false, failed: ['COMMIT'], detail: 'COMMIT' },
    };
  }
  if (input.expectedRunId && String(ev.runId || '') && String(ev.runId) !== input.expectedRunId) {
    return {
      verdict: 'FAIL',
      reason: 'runId-mismatch',
      recomputed: { ok: false, blocked: false, failed: ['RUN_ID'], detail: 'RUN_ID' },
    };
  }
  const started = String(ev.startedUtc || '').trim();
  if (!started) {
    return {
      verdict: 'FAIL',
      reason: 'startedUtc-missing',
      recomputed: { ok: false, blocked: false, failed: ['TIME'], detail: 'TIME' },
    };
  }
  const evMs = Date.parse(started);
  const runMs = Date.parse(input.runStartedIso);
  if (Number.isNaN(evMs) || Number.isNaN(runMs) || evMs / 1000 + 2 < runMs / 1000) {
    return {
      verdict: 'FAIL',
      reason: 'stale-or-unparseable-time',
      recomputed: { ok: false, blocked: false, failed: ['TIME'], detail: 'TIME' },
    };
  }

  const steps = Array.isArray(ev.steps) ? ev.steps : [];
  if (ev.ok === true && steps.length === 0) {
    return {
      verdict: 'FAIL',
      reason: 'ok-true-with-empty-steps',
      recomputed: { ok: false, blocked: false, failed: ['EMPTY_STEPS'], detail: 'EMPTY_STEPS' },
    };
  }

  const recomputed = judgeR2Acceptance(steps);
  // Conflict: document claims blocked but an executed step failed → FAIL
  if (ev.blocked === true && steps.some((s) => s.ok === false)) {
    return {
      verdict: 'FAIL',
      reason: 'blocked-conflicts-with-executed-failure',
      recomputed: { ok: false, blocked: false, failed: recomputed.failed, detail: 'BLOCKED_WITH_FAILURE' },
    };
  }
  // Conflict: document ok=true but recomputed not ok
  if (ev.ok === true && !recomputed.ok) {
    return {
      verdict: 'FAIL',
      reason: 'summary-ok-conflicts-with-steps',
      recomputed,
    };
  }
  if (recomputed.blocked) {
    return { verdict: 'BLOCKED', reason: recomputed.detail, recomputed };
  }
  if (recomputed.ok && input.exitCode === 0 && ev.ok === true) {
    return { verdict: 'PASS', reason: 'PASS', recomputed };
  }
  if (recomputed.ok && input.exitCode === 0 && ev.blocked !== true) {
    // Prefer recomputed over stale summary.ok
    return { verdict: 'PASS', reason: 'PASS_RECOMPUTED', recomputed };
  }
  return {
    verdict: 'FAIL',
    reason: recomputed.detail || `exit-${input.exitCode}`,
    recomputed,
  };
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
