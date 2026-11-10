/**
 * Shared FIN acceptance evaluators — used by both the positive journey and negative probes.
 * Delivery gate must call these same functions; do not duplicate predicates in report code.
 */

export type VideoChrome = {
  text?: string;
  state?: string;
  phase?: string;
  pick?: string;
  pickAction?: string;
  inputFiles?: number;
};

export type MainVideoIsolationEvidence = {
  savedOnlyOk?: boolean;
  mainIdBefore?: string | null;
  duringDetailChrome?: VideoChrome | null;
  mainSurvivedDetail?: boolean;
  mainSurvivedDetailFail?: boolean;
  detailFailShown?: boolean;
  detailRetryClicked?: boolean;
  detailRetrySucceeded?: boolean;
  detailFailHitTargetSession?: boolean;
  mainSurvivedCancel?: boolean;
  cancelClicked?: boolean;
  cancelObserved?: boolean;
  /** Card status text that must itself contain 50% — boolean flags are ignored. */
  pct50CardText?: string | null;
  sawTransferComplete?: boolean;
  sawVerifyingWhileHeld?: boolean;
  readyBeforeVerifyReleased?: boolean;
  sawFail?: boolean;
  sawRetryLabel?: boolean;
  mainRetryClicked?: boolean;
  cycleSessionId?: string | null;
  cycleNewMediaId?: string | null;
  /** Session id observed at fail time; retry must resume this same id when durable parts exist. */
  failSessionId?: string | null;
  resumedSameSession?: boolean;
  durablePartsBeforeRetry?: boolean;
  /** catalogMediaId bound on the upload session row after success. */
  sessionBoundMediaId?: string | null;
  cycleSaved?: boolean;
  finalMainId?: string | null;
  finalChrome?: VideoChrome | null;
  detailRolesOk?: boolean;
};

/** Card text must show 50% — not 0%, not 0.5%, not a bare ratio flag. */
export function evaluateDisplayedProgress50(cardText: string | null | undefined): boolean {
  const t = String(cardText || '');
  if (/0\.5%/.test(t)) return false;
  if (!/50%/.test(t)) return false;
  const percents = t.match(/(\d+(?:\.\d+)?)%/g) || [];
  if (!percents.some((p) => p === '50%')) return false;
  return true;
}

function missing(v: unknown): boolean {
  return v === undefined || v === null;
}

/**
 * Strict FIN-02 evaluator. Any required observation that is undefined/missing fails.
 * 50% is proven only from pct50CardText — a boolean flag cannot override wrong/missing text.
 */
export function evaluateMainVideoIsolation(ev: MainVideoIsolationEvidence): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (ev.savedOnlyOk !== true) reasons.push('saved-only reopen failed');
  if (missing(ev.mainIdBefore) || !ev.mainIdBefore) reasons.push('missing main id before detail ops');
  if (ev.mainSurvivedDetail !== true) reasons.push('main lost during detail upload');
  if (missing(ev.duringDetailChrome) || ev.duringDetailChrome?.state !== 'saved') {
    reasons.push('main chrome not saved during detail');
  }
  if (ev.mainSurvivedDetailFail !== true) reasons.push('main lost during detail fail');
  if (ev.detailFailShown !== true) reasons.push('detail fail not shown on detail card');
  if (ev.detailRetryClicked !== true) reasons.push('detail retry button not clicked');
  if (ev.detailRetrySucceeded !== true) reasons.push('detail retry did not save detail media');
  if (ev.detailFailHitTargetSession !== true) reasons.push('fail injection did not hit detail session');
  if (ev.mainSurvivedCancel !== true) reasons.push('main lost during detail cancel');
  if (ev.cancelClicked !== true) reasons.push('detail cancel button not clicked');
  if (ev.cancelObserved !== true) reasons.push('detail cancel result not observed');
  if (!evaluateDisplayedProgress50(ev.pct50CardText)) {
    reasons.push('card did not display 50%');
  }
  if (ev.sawTransferComplete !== true) reasons.push('transfer-complete/hold not observed');
  if (ev.sawVerifyingWhileHeld !== true) reasons.push('verifying/waiting not observed while complete held');
  if (ev.readyBeforeVerifyReleased !== false) {
    reasons.push('ready declared before verify released');
  }
  if (ev.sawFail !== true) reasons.push('main upload fail not observed');
  if (ev.sawRetryLabel !== true) reasons.push('main retry affordance missing');
  if (ev.mainRetryClicked !== true) reasons.push('main retry not clicked');
  if (ev.durablePartsBeforeRetry !== true) reasons.push('no durable completed parts before retry');
  if (ev.resumedSameSession !== true) reasons.push('retry did not resume the fail session');
  if (ev.cycleSaved !== true) reasons.push('main retry cycle did not reach saved');
  if (missing(ev.cycleSessionId) || !ev.cycleSessionId) reasons.push('missing cycle session id');
  if (missing(ev.cycleNewMediaId) || !ev.cycleNewMediaId) reasons.push('missing cycle media id');
  // failSessionId is mandatory — null/undefined/empty fails; must match cycle session.
  if (missing(ev.failSessionId) || !ev.failSessionId) {
    reasons.push('missing fail session id');
  } else if (ev.cycleSessionId && ev.failSessionId !== ev.cycleSessionId) {
    reasons.push('cycle session diverged from fail session without proven reason');
  }
  if (
    !missing(ev.sessionBoundMediaId) &&
    ev.sessionBoundMediaId &&
    ev.cycleNewMediaId &&
    ev.sessionBoundMediaId !== ev.cycleNewMediaId
  ) {
    reasons.push('final media not bound to cycle session');
  }
  if (missing(ev.sessionBoundMediaId) || !ev.sessionBoundMediaId) {
    reasons.push('session-bound media id missing');
  }
  // finalMainId is mandatory — null/undefined/empty fails; must match cycle media.
  if (missing(ev.finalMainId) || !ev.finalMainId) {
    reasons.push('missing final main id');
  } else if (ev.cycleNewMediaId && ev.finalMainId !== ev.cycleNewMediaId) {
    reasons.push('final main id does not match cycle media');
  }
  if (ev.mainIdBefore && ev.cycleNewMediaId && ev.mainIdBefore === ev.cycleNewMediaId) {
    reasons.push('retry reused prior main media id (no new bind)');
  }
  if (missing(ev.finalChrome) || ev.finalChrome?.state !== 'saved') reasons.push('final chrome not saved');
  if (ev.detailRolesOk !== true) reasons.push('detail placement roles incorrect');
  return { ok: reasons.length === 0, reasons };
}

/** Build a complete SUCCESS evidence object for gate/negative probes, then override one field. */
export function baselineMainVideoIsolationSuccess(
  overrides: Partial<MainVideoIsolationEvidence> = {},
): MainVideoIsolationEvidence {
  return {
    savedOnlyOk: true,
    mainIdBefore: 'main-before',
    duringDetailChrome: { state: 'saved', text: 'فيديو محفوظ على العنصر · draft — يمكن استبداله.' },
    mainSurvivedDetail: true,
    mainSurvivedDetailFail: true,
    detailFailShown: true,
    detailRetryClicked: true,
    detailRetrySucceeded: true,
    detailFailHitTargetSession: true,
    mainSurvivedCancel: true,
    cancelClicked: true,
    cancelObserved: true,
    pct50CardText: 'جارٍ الرفع: clip.mp4 · 50%',
    sawTransferComplete: true,
    sawVerifyingWhileHeld: true,
    readyBeforeVerifyReleased: false,
    sawFail: true,
    sawRetryLabel: true,
    mainRetryClicked: true,
    durablePartsBeforeRetry: true,
    resumedSameSession: true,
    failSessionId: 'sess-1',
    cycleSessionId: 'sess-1',
    cycleNewMediaId: 'media-2',
    sessionBoundMediaId: 'media-2',
    cycleSaved: true,
    finalMainId: 'media-2',
    finalChrome: { state: 'saved', text: 'فيديو محفوظ على العنصر · draft — يمكن استبداله.' },
    detailRolesOk: true,
    ...overrides,
  };
}

export type DevResumeEvidence = {
  failInjected: boolean;
  failStatus: number;
  stillDraft: boolean;
  resumeActive?: string;
  resumeLabel?: string;
  account?: string;
  labels?: string[];
  resumeReqStatus?: number | null;
  published: boolean;
  matchCount: number;
  fixtureId: string;
  matchIds?: string[];
  injectedButtonText?: boolean;
  injectedResumeActive?: boolean;
};

export function evaluateDevResumePublish(ev: DevResumeEvidence): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!ev.failInjected) reasons.push('API fail not injected');
  if (ev.failStatus !== 503) reasons.push('fail status not 503');
  if (!ev.stillDraft) reasons.push('item not draft after fail');
  if (ev.resumeActive !== '1') reasons.push('resume not active from app');
  if (!/استئناف النشر|استكمال النشر/.test(ev.resumeLabel || '')) reasons.push('wrong resume label');
  if (/إرسال للمراجعة/.test(ev.resumeLabel || '')) reasons.push('review wording on developer resume');
  if (ev.account !== 'developer') reasons.push('account not developer');
  const finals = (ev.labels || []).filter((t) =>
    /نشر الآن|استئناف النشر|استكمال النشر|إرسال للمراجعة|استئناف الإرسال/.test(t),
  );
  if (finals.length !== 1) reasons.push('not exactly one final CTA');
  if (!(ev.labels || []).some((t) => /حفظ المسودة/.test(t))) reasons.push('draft save missing');
  if (!(ev.resumeReqStatus != null && ev.resumeReqStatus >= 200 && ev.resumeReqStatus < 300)) {
    reasons.push('resume request not successful');
  }
  if (!ev.published) reasons.push('not published after resume');
  if (ev.matchCount !== 1) reasons.push('duplicate or missing product after resume');
  if (!ev.matchIds || ev.matchIds[0] !== ev.fixtureId) reasons.push('published id mismatch');
  if (ev.injectedButtonText || ev.injectedResumeActive) reasons.push('test injected resume UI');
  return { ok: reasons.length === 0, reasons };
}

export type QtyNeighborsEvidence = {
  emptyPersisted: boolean;
  zeroPersisted: boolean;
  neighborsEmptyStable: boolean;
  neighborsZeroStable: boolean;
  negOk: boolean;
};

export function evaluateQtyEmptyZero(ev: QtyNeighborsEvidence): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!ev.emptyPersisted) reasons.push('empty qty not persisted');
  if (!ev.zeroPersisted) reasons.push('zero qty not persisted');
  if (!ev.neighborsEmptyStable) reasons.push('neighbors drifted on empty journey');
  if (!ev.neighborsZeroStable) reasons.push('neighbors drifted on zero journey');
  if (!ev.negOk) reasons.push('negative neighbor probe did not reject drift');
  return { ok: reasons.length === 0, reasons };
}
