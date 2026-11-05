/** Pure R2 acceptance judgment — SDK success alone never yields PASS. */

export const REQUIRED_MIRA_STEPS = [
  'R2_MIRA_CREATE_SESSION',
  'R2_MIRA_SIGN_PARTS',
  'R2_MIRA_BROWSER_PUT',
  'R2_MIRA_COMPLETE',
  'R2_MIRA_READY',
  'R2_MIRA_BIND',
  'R2_MIRA_READ_FULL',
  'R2_MIRA_READ_RANGE',
  'R2_MIRA_ABORT_READ',
] as const;

export function judgeR2Acceptance(steps: Array<{ id: string; ok: boolean | 'BLOCKED' }>): {
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
