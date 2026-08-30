/**
 * FK-10 — Implements FashionAdvisorEnvelopeProjectionPort (declared in FK-2).
 * Returns fragment id only — no beauty-advisor import.
 */
import type { FashionAdviceCandidate } from '../advice/advice-candidate';
import type { FashionClaimLockResult } from '../contracts/claim-lock';
import type { FashionClaimLockContext } from '../runtime/evaluation-context';
import type { FashionAdvisorEnvelopeProjectionPort } from '../ports/extension-ports';
import { createHash } from 'crypto';
import { projectClaimLockedCandidate } from './eligibility';

export class FashionAdvisorEnvelopeProjectionPortImpl
  implements FashionAdvisorEnvelopeProjectionPort
{
  async projectLockedCandidate(input: {
    readonly candidate: FashionAdviceCandidate;
    readonly lock: FashionClaimLockResult;
    readonly context: FashionClaimLockContext;
  }): Promise<{ envelopeFragmentId: string }> {
    const projection = projectClaimLockedCandidate({
      candidate: input.candidate,
      lock: input.lock,
      clockNowIso: input.context.clock.nowIso,
    });
    const envelopeFragmentId = createHash('sha256')
      .update(
        `${projection.projectionId}|${projection.fragments.map((f) => f.claimKey).join(',')}`,
        'utf8',
      )
      .digest('hex')
      .slice(0, 20);
    return { envelopeFragmentId: `fef_${envelopeFragmentId}` };
  }
}
