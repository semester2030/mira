/**
 * FK-3 — Output sanitization for structured text fields.
 */
import { validateToneSafety } from '../validation/tone-safety';

const SYSTEM_LEAK =
  /system prompt|you are not the final|FashionAdviceCandidateDraft schema|chain-of-thought|ignore previous/i;
const FAKE_SOURCE =
  /\b(according to|source:)\s+(vogue|dior|chanel|harvard|fashion school)/i;
const PRODUCT_AVAIL =
  /in stock|available at|buy now|sku:|add to cart|سعر المنتج متوفر/i;

export interface SanitizationIssue {
  readonly code: string;
  readonly message: string;
}

export function sanitizeStructuredDraftText(blob: string): SanitizationIssue[] {
  const issues: SanitizationIssue[] = [];
  if (SYSTEM_LEAK.test(blob)) {
    issues.push({
      code: 'system_prompt_leakage',
      message: 'Draft leaks system/policy text',
    });
  }
  if (FAKE_SOURCE.test(blob)) {
    issues.push({
      code: 'fake_citation',
      message: 'Draft contains unsupported source citation language',
    });
  }
  if (PRODUCT_AVAIL.test(blob)) {
    issues.push({
      code: 'product_availability',
      message: 'Draft claims product availability',
    });
  }
  for (const t of validateToneSafety(blob)) {
    issues.push({ code: t.code, message: t.message });
  }
  if (/\bfashn\b|openai|provider_id|api[_-]?key/i.test(blob)) {
    issues.push({
      code: 'provider_leakage',
      message: 'Draft leaks provider metadata',
    });
  }
  return issues;
}
