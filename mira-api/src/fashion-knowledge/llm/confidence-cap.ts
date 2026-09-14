/**
 * FK-3 — Confidence cap for uncurated LLM knowledge.
 */
import {
  KnowledgeConfidence,
  capConfidenceForLlm,
} from '../contracts/confidence';
import { SubjectivityLevel } from '../contracts/subjectivity';

/**
 * Uncurated LLM never receives HIGH curated confidence.
 * High-subjectivity advice capped at LOW.
 */
export function applyLlmConfidenceCap(
  estimate: KnowledgeConfidence | undefined,
  subjectivity: SubjectivityLevel,
): KnowledgeConfidence {
  const base = estimate ?? KnowledgeConfidence.MEDIUM;
  let capped = capConfidenceForLlm(base);
  if (
    subjectivity === SubjectivityLevel.HIGH_SUBJECTIVITY ||
    subjectivity === SubjectivityLevel.USER_DEPENDENT
  ) {
    if (capped === KnowledgeConfidence.MEDIUM) {
      capped = KnowledgeConfidence.LOW;
    }
  }
  if (capped === KnowledgeConfidence.HIGH) {
    capped = KnowledgeConfidence.MEDIUM;
  }
  return capped;
}
