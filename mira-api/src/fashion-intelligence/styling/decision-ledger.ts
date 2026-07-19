/**
 * Internal immutable Styling Decision Ledger — not a public API.
 */
import { StyleDecision } from './canonical-styling-profile';

export interface StyleDecisionLedgerEntry {
  decisionId: string;
  timestamp: string;
  evidenceIds: string[];
  reasoningPolicyVersion: string;
  decisionVersion: string;
  confidence: number;
  limitations: string[];
  outcome: string;
  historyRef: string;
  claim: string;
}

export interface StyleDecisionLedger {
  ledgerId: string;
  entries: StyleDecisionLedgerEntry[];
}

export class StyleDecisionLedgerBuilder {
  private readonly entries: StyleDecisionLedgerEntry[] = [];

  constructor(private readonly ledgerId: string) {}

  append(decision: StyleDecision, historyRef: string): void {
    if (this.entries.some((e) => e.decisionId === decision.decisionId)) {
      return;
    }
    this.entries.push({
      decisionId: decision.decisionId,
      timestamp: decision.createdAt,
      evidenceIds: [...decision.evidenceRefs].sort(),
      reasoningPolicyVersion: decision.reasoningPolicyVersion,
      decisionVersion: decision.decisionVersion,
      confidence: decision.confidence,
      limitations: [...decision.limitations].sort(),
      outcome: decision.outcome,
      historyRef,
      claim: decision.claim,
    });
  }

  build(): StyleDecisionLedger {
    return {
      ledgerId: this.ledgerId,
      entries: [...this.entries].sort((a, b) =>
        a.decisionId.localeCompare(b.decisionId),
      ),
    };
  }
}
