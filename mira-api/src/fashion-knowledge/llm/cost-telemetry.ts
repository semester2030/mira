/**
 * FK-3 — Internal cost/usage telemetry hooks (no PII).
 */
export interface FashionLlmCostEvent {
  readonly event:
    | 'request'
    | 'success'
    | 'malformed'
    | 'blocked'
    | 'qualified'
    | 'clarification'
    | 'retry'
    | 'failed'
    | 'disabled';
  readonly traceId: string;
  readonly providerId?: string;
  readonly latencyMs?: number;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly attempt?: number;
}

export type FashionLlmCostSink = (event: FashionLlmCostEvent) => void;

export function createInMemoryCostSink(): {
  readonly record: FashionLlmCostSink;
  readonly events: FashionLlmCostEvent[];
} {
  const events: FashionLlmCostEvent[] = [];
  return {
    events,
    record: (e) => {
      events.push(e);
    },
  };
}
