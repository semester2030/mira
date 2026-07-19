import { BeautyCapabilityId } from '../capability/capability-ids';
import { ReadinessProviderId } from '../provider-readiness/types';
import { beautyTelemetry } from './beauty-telemetry';
import { newTraceId } from '../../ports/shared/result-meta';

/**
 * Provider activation hooks — wired so later activation needs NO Flutter/Session/DTO changes.
 * 5B.1: hooks are registered but never call external providers.
 */
export type ProviderActivationHook = (ctx: {
  providerId: ReadinessProviderId;
  capabilityId: BeautyCapabilityId;
  evidenceRef?: string;
}) => void | Promise<void>;

const hooks: ProviderActivationHook[] = [];

export function registerProviderActivationHook(hook: ProviderActivationHook): void {
  hooks.push(hook);
}

export function clearProviderActivationHooks(): void {
  hooks.length = 0;
}

/**
 * Notify hooks after readiness checklist would pass in production.
 * Does NOT execute try-on. Does NOT call Perfect/Banuba.
 */
export async function notifyProviderActivated(ctx: {
  providerId: ReadinessProviderId;
  capabilityId: BeautyCapabilityId;
  evidenceRef?: string;
}): Promise<void> {
  beautyTelemetry.track({
    name: 'beauty_provider_activation_hook',
    traceId: newTraceId('bact'),
    capabilityId: ctx.capabilityId,
    props: {
      providerId: ctx.providerId,
      evidenceRef: ctx.evidenceRef ?? null,
      liveExecution: false,
    },
  });
  for (const hook of hooks) {
    await hook(ctx);
  }
}

/**
 * Capability placeholders — catalog capabilities with integration metadata.
 * executionAllowed remains false until provider activation + flags.
 */
export interface CapabilityPlaceholder {
  capabilityId: BeautyCapabilityId;
  integrationReady: true;
  providerExecutionEnabled: false;
  activationHookRegistered: boolean;
  note: string;
}

export function listCapabilityPlaceholders(
  ids: BeautyCapabilityId[],
): CapabilityPlaceholder[] {
  return ids.map((capabilityId) => ({
    capabilityId,
    integrationReady: true as const,
    providerExecutionEnabled: false as const,
    activationHookRegistered: hooks.length > 0,
    note: 'Session/DTO/history ready; provider execution disabled until 5B license',
  }));
}
