import { BeautyCapabilityId, BeautyCapabilityMetadata } from './capability-ids';
import { CapabilityRegistry } from './capability-registry';
import {
  BeautyRuntimeState,
  runtimeUnavailable,
} from '../runtime/beauty-runtime-state';

export interface CapabilityAvailability {
  capabilityId: BeautyCapabilityId;
  metadata: BeautyCapabilityMetadata;
  registered: true;
  executionAllowed: boolean;
  runtime: BeautyRuntimeState;
}

export class CapabilityEngine {
  constructor(private readonly registry: CapabilityRegistry) {}

  resolve(capabilityId: string): CapabilityAvailability {
    const id = this.registry.assertKnown(capabilityId);
    const metadata = this.registry.get(id)!;
    const executionAllowed = metadata.executionEnabled;
    const runtime = executionAllowed
      ? {
          status: 'AVAILABLE' as const,
          stage: 'registry' as const,
          capabilityId: id,
          capabilityVersion: metadata.version,
          reasonEn: 'Capability execution allowed.',
          reasonAr: 'تنفيذ القدرة مسموح.',
        }
      : runtimeUnavailable(
          'catalog_execution_disabled',
          'Capability is catalogued but execution is not enabled (pre-5B freeze).',
          'القدرة مفهرسة لكن التنفيذ غير مفعّل (قبل المرحلة 5B).',
          id,
          undefined,
          {
            stage: 'registry',
            capabilityVersion: metadata.version,
          },
        );
    return {
      capabilityId: id,
      metadata,
      registered: true,
      executionAllowed,
      runtime,
    };
  }

  /** Public capability list — no provider fields (Law #14) */
  listPublic() {
    return this.registry.list().map((m) => ({
      capabilityId: m.id,
      version: m.version,
      formulaId: m.formulaId,
      category: m.category,
      group: m.group,
      status: m.status,
      modes: m.modes,
      platforms: m.platforms,
      realtime: m.realtime,
      offline: m.offline,
      costClass: m.costClass,
      requiredAssets: m.requiredAssets,
      dependencies: m.dependencies,
      qualityRequirements: m.qualityRequirements,
      labelEn: m.displayNameEn,
      labelAr: m.displayNameAr,
      descriptionEn: m.descriptionEn,
      descriptionAr: m.descriptionAr,
      futureStatus: m.futureStatus,
      deprecationPolicy: m.deprecationPolicy,
    }));
  }
}
