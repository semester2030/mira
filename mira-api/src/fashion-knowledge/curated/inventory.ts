/**
 * FK-5 — Active vs review-candidate inventories (honest).
 */
import { FK5_COLOR_REVIEW_CANDIDATES } from './review-candidates-color';
import { FK5_OCCASION_REVIEW_CANDIDATES } from './review-candidates-occasion';
import { filterReleaseEligibleCandidates } from './promotion-gate';
import { listActivatingSources, listSourcingGaps } from './source-discovery';

export interface Fk5InventoryReport {
  readonly productionActiveRuleIds: readonly string[];
  readonly approvedButNotActiveRuleIds: readonly string[];
  readonly reviewCandidateIds: readonly string[];
  readonly releaseEligibleWithProvenHumanApproval: readonly string[];
  readonly activatingSourcesFound: number;
  readonly sourcingGapCount: number;
  readonly productionRegistryRemainsEmpty: boolean;
  readonly notes: string;
}

export function buildFk5InventoryReport(
  opts?: { readonly humanApprovalProven?: boolean },
): Fk5InventoryReport {
  const all = [...FK5_COLOR_REVIEW_CANDIDATES, ...FK5_OCCASION_REVIEW_CANDIDATES];
  const eligible = filterReleaseEligibleCandidates(all, {
    humanApprovalProven: opts?.humanApprovalProven === true,
  });

  return Object.freeze({
    productionActiveRuleIds: Object.freeze([]),
    approvedButNotActiveRuleIds: Object.freeze([]),
    reviewCandidateIds: Object.freeze(all.map((c) => c.candidateId)),
    releaseEligibleWithProvenHumanApproval: Object.freeze(
      eligible.map((c) => c.candidateId),
    ),
    activatingSourcesFound: listActivatingSources().length,
    sourcingGapCount: listSourcingGaps().length,
    productionRegistryRemainsEmpty: true,
    notes:
      'FK-5 ships review candidates + models only. Zero ACTIVE production rules because repository lacks Tier A/B authorities and human approval is not proven.',
  });
}
