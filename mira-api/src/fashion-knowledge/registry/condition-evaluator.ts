/**
 * FK-4 — Deterministic condition evaluator (FK-2 operators). Fail closed.
 */
import {
  ConditionOperator,
  type FashionRuleCondition,
} from '../contracts/conditions';

export type FactBag = Readonly<
  Record<string, string | number | boolean | readonly string[] | readonly number[] | null | undefined>
>;

export interface ConditionEvalResult {
  readonly ok: boolean;
  readonly matched: boolean;
  readonly reason?: string;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? [...v] : v == null ? [] : [v];
}

function toNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) {
    return Number(v);
  }
  return undefined;
}

export function evaluateCondition(
  condition: FashionRuleCondition,
  facts: FactBag,
): ConditionEvalResult {
  const fieldVal = facts[condition.field];
  const op = condition.operator;
  const expected = condition.value;

  switch (op) {
    case ConditionOperator.EXISTS:
      return {
        ok: true,
        matched: fieldVal !== undefined && fieldVal !== null && fieldVal !== '',
      };
    case ConditionOperator.NOT_EXISTS:
      return {
        ok: true,
        matched: fieldVal === undefined || fieldVal === null || fieldVal === '',
      };
    case ConditionOperator.EQUALS:
      return { ok: true, matched: fieldVal === expected };
    case ConditionOperator.NOT_EQUALS:
      return { ok: true, matched: fieldVal !== expected };
    case ConditionOperator.IN: {
      if (!Array.isArray(expected)) {
        return { ok: false, matched: false, reason: 'IN requires array value' };
      }
      return { ok: true, matched: asArray(fieldVal).some((x) => expected.includes(x as never)) };
    }
    case ConditionOperator.NOT_IN: {
      if (!Array.isArray(expected)) {
        return {
          ok: false,
          matched: false,
          reason: 'NOT_IN requires array value',
        };
      }
      return {
        ok: true,
        matched: !asArray(fieldVal).some((x) => expected.includes(x as never)),
      };
    }
    case ConditionOperator.CONTAINS: {
      const hay = asArray(fieldVal).map(String);
      if (Array.isArray(expected)) {
        return {
          ok: true,
          matched: expected.every((e) => hay.includes(String(e))),
        };
      }
      return { ok: true, matched: hay.includes(String(expected)) };
    }
    case ConditionOperator.ANY_OF: {
      if (!Array.isArray(expected)) {
        return {
          ok: false,
          matched: false,
          reason: 'ANY_OF requires array value',
        };
      }
      const set = new Set(asArray(fieldVal).map(String));
      return {
        ok: true,
        matched: expected.some((e) => set.has(String(e))),
      };
    }
    case ConditionOperator.ALL_OF: {
      if (!Array.isArray(expected)) {
        return {
          ok: false,
          matched: false,
          reason: 'ALL_OF requires array value',
        };
      }
      const set = new Set(asArray(fieldVal).map(String));
      return {
        ok: true,
        matched: expected.every((e) => set.has(String(e))),
      };
    }
    case ConditionOperator.RANGE: {
      const n = toNumber(fieldVal);
      if (
        n === undefined ||
        typeof expected !== 'object' ||
        expected === null ||
        Array.isArray(expected) ||
        !('min' in expected) ||
        !('max' in expected)
      ) {
        return {
          ok: false,
          matched: false,
          reason: 'RANGE requires numeric field and {min,max}',
        };
      }
      const range = expected as { min: number; max: number };
      return { ok: true, matched: n >= range.min && n <= range.max };
    }
    case ConditionOperator.GREATER_THAN: {
      const n = toNumber(fieldVal);
      const e = toNumber(expected);
      if (n === undefined || e === undefined) {
        return {
          ok: false,
          matched: false,
          reason: 'GREATER_THAN requires numbers',
        };
      }
      return { ok: true, matched: n > e };
    }
    case ConditionOperator.LESS_THAN: {
      const n = toNumber(fieldVal);
      const e = toNumber(expected);
      if (n === undefined || e === undefined) {
        return {
          ok: false,
          matched: false,
          reason: 'LESS_THAN requires numbers',
        };
      }
      return { ok: true, matched: n < e };
    }
    default:
      return {
        ok: false,
        matched: false,
        reason: `Unsupported operator ${String(op)}`,
      };
  }
}

export function evaluateAllConditions(
  conditions: readonly FashionRuleCondition[],
  facts: FactBag,
): ConditionEvalResult {
  if (conditions.length === 0) return { ok: true, matched: true };
  for (const c of conditions) {
    const r = evaluateCondition(c, facts);
    if (!r.ok) return r;
    if (!r.matched) return { ok: true, matched: false, reason: r.reason };
  }
  return { ok: true, matched: true };
}
