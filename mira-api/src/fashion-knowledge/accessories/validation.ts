/**
 * FK-6 — Validation helpers (fail closed).
 */
import type { FashionAccessoryFact } from './fact-projection';
import { AccessoryPresence, MetallicFamily } from './models';
import { isFashionAdviceType } from '../contracts/advice-types';
import { validateToneSafety } from '../validation/tone-safety';

export interface Fk6ValidationIssue {
  readonly code: string;
  readonly message: string;
}

export function validateAccessoryFact(
  fact: FashionAccessoryFact,
): { ok: boolean; issues: readonly Fk6ValidationIssue[] } {
  const issues: Fk6ValidationIssue[] = [];
  if (!fact.accessoryId) {
    issues.push({ code: 'missing_id', message: 'accessoryId required' });
  }
  if (
    fact.presence !== AccessoryPresence.PRESENT &&
    fact.presence !== AccessoryPresence.ABSENT &&
    fact.presence !== AccessoryPresence.UNKNOWN
  ) {
    issues.push({ code: 'invalid_presence', message: 'presence invalid' });
  }
  if (
    fact.presence === AccessoryPresence.UNKNOWN &&
    (fact.primaryColor || fact.material || fact.type)
  ) {
    // Allow optional partial facts, but warn if claiming ABSENT semantics — not an error
  }
  if (
    fact.metallicFamily &&
    !Object.values(MetallicFamily).includes(fact.metallicFamily as never)
  ) {
    issues.push({ code: 'invalid_metallic', message: 'metallicFamily invalid' });
  }
  if (fact.presence === AccessoryPresence.PRESENT && fact.evidenceRefs.length === 0) {
    issues.push({
      code: 'present_without_evidence',
      message: 'PRESENT requires evidence refs',
    });
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}

export function validateNoShoppingLanguage(text: string): boolean {
  return !/\bsku\b|\bin stock\b|\$\d+|buy now|brand recommendation|gucci|louis vuitton/i.test(
    text,
  );
}

export function validateFk6AdvicePayload(input: {
  readonly adviceType: string;
  readonly texts: readonly string[];
}): { ok: boolean; issues: readonly Fk6ValidationIssue[] } {
  const issues: Fk6ValidationIssue[] = [];
  if (!isFashionAdviceType(input.adviceType)) {
    issues.push({ code: 'invalid_advice_type', message: input.adviceType });
  }
  for (const t of input.texts) {
    for (const i of validateToneSafety(t)) {
      issues.push({ code: i.code, message: i.message });
    }
    if (!validateNoShoppingLanguage(t)) {
      issues.push({
        code: 'shopping_language',
        message: 'SKU/brand/price language prohibited',
      });
    }
  }
  return { ok: issues.length === 0, issues: Object.freeze(issues) };
}
