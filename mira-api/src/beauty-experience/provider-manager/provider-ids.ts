/**
 * Internal provider ids — never sent to Flutter product UI as selection keys.
 * Used only by Provider Manager / adapters / server audit.
 */
export type BeautyProviderId =
  | 'disabled'
  | 'perfect_beauty'
  | 'banuba_beauty'
  | 'future';

export interface BeautyProviderDescriptor {
  id: BeautyProviderId;
  version: string;
  /** Display for ops only */
  label: string;
  licensed: boolean;
  /** Foundation: no real SDK — stubs only */
  sdkInstalled: boolean;
  health: 'healthy' | 'degraded' | 'down' | 'unconfigured';
}
