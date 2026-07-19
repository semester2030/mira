import { BeautyCapabilityId, BeautyDependencyId } from './capability-ids';
import { defaultCapabilityRegistry } from './capability-registry';
import { BEAUTY_CAPABILITY_DEPENDENCY_GRAPH_VERSION } from './catalog-release';

export interface DependencyNode {
  id: string;
  kind: 'capability' | 'asset' | 'system';
}

export interface DependencyEdge {
  from: string;
  to: string;
  explicit: true;
}

/**
 * Explicit dependency graph — never inferred (Law #15).
 */
export function buildCapabilityDependencyGraph(capabilityId?: BeautyCapabilityId): {
  version: string;
  nodes: DependencyNode[];
  edges: DependencyEdge[];
} {
  const caps = capabilityId
    ? [defaultCapabilityRegistry.get(capabilityId)!]
    : defaultCapabilityRegistry.list();

  const nodes = new Map<string, DependencyNode>();
  const edges: DependencyEdge[] = [];

  const addNode = (id: string, kind: DependencyNode['kind']) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind });
  };

  for (const cap of caps) {
    addNode(cap.id, 'capability');
    for (const dep of cap.dependencies) {
      const kind = classifyDep(dep);
      addNode(dep, kind);
      edges.push({ from: cap.id, to: dep, explicit: true });
    }
  }

  return {
    version: BEAUTY_CAPABILITY_DEPENDENCY_GRAPH_VERSION,
    nodes: [...nodes.values()],
    edges,
  };
}

function classifyDep(dep: BeautyDependencyId): DependencyNode['kind'] {
  if (
    dep === 'capability_policy' ||
    dep === 'provider_manager' ||
    dep === 'beauty_session' ||
    dep === 'subscription_entitlement' ||
    dep === 'user_consent'
  ) {
    return 'system';
  }
  if (
    dep === 'lip' ||
    dep === 'foundation' ||
    dep === 'blush' ||
    dep === 'eyeshadow' ||
    dep === 'contour' ||
    dep === 'hair_color' ||
    dep === 'hair_style' ||
    dep === 'glasses' ||
    dep === 'look' ||
    dep === 'makeup_vto'
  ) {
    return 'capability';
  }
  return 'asset';
}

/** Example documented chain for hair_color */
export const HAIR_COLOR_DEPENDENCY_CHAIN = [
  'hair_color',
  'hair_mask',
  'face_alignment',
  'capture_quality',
  'capability_policy',
] as const;
