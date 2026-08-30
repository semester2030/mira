/**
 * FK-4 — Deterministic hashing helpers (stable JSON + sha256).
 */
import { createHash } from 'node:crypto';

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export function sha256Hex(parts: readonly string[]): string {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export function contentHash(value: unknown): string {
  return sha256Hex([stableStringify(value)]);
}
