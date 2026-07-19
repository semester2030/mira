/**
 * @deprecated Phase 5A — use BeautyExperiencePort instead.
 *
 * BeautyTryOnPort remains for backward compatibility with PortsModule bindings
 * and Phase 1 schema tests. Try-On is now one capability (`makeup_vto` / `lip`…)
 * under Beauty Experience — not a separate platform.
 *
 * Migration:
 * 1. Inject BEAUTY_EXPERIENCE_PORT (BeautyExperiencePort)
 * 2. Call listCapabilities() / executeCapability({ capabilityId })
 * 3. Do not request providers from Flutter
 * 4. Remove BeautyTryOnPort usage in new code
 *
 * See: docs/architecture/beauty_experience_tryon_port_migration.md
 */
import { ResultMeta } from '../shared/result-meta';
import { ProviderPortError } from '../shared/provider-error';

export const BEAUTY_TRYON_PORT = Symbol('BEAUTY_TRYON_PORT');

export interface TryOnCapability {
  id: string;
  available: boolean;
  reason?: string;
}

export interface TryOnRequest {
  imageBytes: Buffer;
  lookId?: string;
  capabilities?: string[];
  traceId?: string;
}

export interface TryOnResult {
  success: false;
  capabilities: TryOnCapability[];
  meta: ResultMeta;
}

/**
 * @deprecated Use BeautyExperiencePort
 */
export interface BeautyTryOnPort {
  listCapabilities(): Promise<TryOnCapability[]>;
  tryOn(request: TryOnRequest): Promise<TryOnResult>;
}

export type TryOnProviderError = ProviderPortError;
