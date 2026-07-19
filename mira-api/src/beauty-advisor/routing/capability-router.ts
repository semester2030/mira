import type { AdvisorSubsystemId } from '../contracts/advisor-evidence-envelope';
import type { AdvisorIntent, AdvisorActionRoute } from '../contracts/conversation-state';

export interface CapabilityRoute {
  intent: AdvisorIntent;
  targetSubsystems: AdvisorSubsystemId[];
  capabilityHints: string[];
  activationReady: boolean;
  /** Routing only — Advisor never executes frozen engines. */
  action: AdvisorActionRoute;
  supported: boolean;
}

const ROUTE_TABLE: Record<
  AdvisorIntent,
  Omit<CapabilityRoute, 'intent'>
> = {
  skin: {
    targetSubsystems: ['skin_intelligence'],
    capabilityHints: ['skin_report', 'analyze_skin'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_skin',
      kind: 'request_skin_analysis',
      targetSubsystem: 'skin_intelligence',
      reasonAr: 'يلزم تقرير بشرة مجمّد للإجابة.',
    },
  },
  face: {
    targetSubsystems: ['face_intelligence'],
    capabilityHints: ['face_report'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_face',
      kind: 'request_face_analysis',
      targetSubsystem: 'face_intelligence',
      reasonAr: 'يلزم تقرير وجه مجمّد للإجابة.',
    },
  },
  wardrobe: {
    targetSubsystems: ['wardrobe_foundation'],
    capabilityHints: ['wardrobe_session'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_wardrobe',
      kind: 'bind_wardrobe',
      targetSubsystem: 'wardrobe_foundation',
      reasonAr: 'يلزم ربط الخزانة كمرجع فقط.',
    },
  },
  garment: {
    targetSubsystems: ['garment_intelligence'],
    capabilityHints: ['analyze_garment'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_garment',
      kind: 'request_garment',
      targetSubsystem: 'garment_intelligence',
      reasonAr: 'يلزم CanonicalGarment عام كمرجع.',
    },
  },
  outfit: {
    targetSubsystems: ['outfit_intelligence'],
    capabilityHints: ['analyze_outfit'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_outfit',
      kind: 'request_outfit',
      targetSubsystem: 'outfit_intelligence',
      reasonAr: 'يلزم CanonicalOutfit عام كمرجع.',
    },
  },
  styling: {
    targetSubsystems: ['styling_intelligence'],
    capabilityHints: ['analyze_style', 'style_reason', 'style_goals'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_styling',
      kind: 'request_styling',
      targetSubsystem: 'styling_intelligence',
      reasonAr: 'يلزم Canonical Styling Profile عام كمرجع.',
    },
  },
  beauty_experience: {
    targetSubsystems: ['beauty_experience'],
    capabilityHints: ['beauty_experience'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_be',
      kind: 'open_beauty_experience',
      targetSubsystem: 'beauty_experience',
      reasonAr: 'تجربة الجمال Activation Ready — توجيه فقط دون تنفيذ داخلي.',
    },
  },
  goals: {
    targetSubsystems: ['styling_intelligence', 'skin_intelligence'],
    capabilityHints: ['style_goals', 'skin_progress'],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_goals',
      kind: 'request_styling',
      targetSubsystem: 'styling_intelligence',
      reasonAr: 'الأهداف تُستشهد عبر مراجع الملفات المجمّدة فقط.',
    },
  },
  general: {
    targetSubsystems: [],
    capabilityHints: [],
    activationReady: true,
    supported: true,
    action: {
      actionId: 'route_general',
      kind: 'none',
      reasonAr: 'إجابة عامة من الظرف المتاح فقط.',
    },
  },
  unsupported: {
    targetSubsystems: [],
    capabilityHints: [],
    activationReady: false,
    supported: false,
    action: {
      actionId: 'route_unsupported',
      kind: 'none',
      reasonAr: 'الطلب خارج نطاق المستشارة (تسوق/سوق).',
    },
  },
  blocked: {
    targetSubsystems: [],
    capabilityHints: [],
    activationReady: false,
    supported: false,
    action: {
      actionId: 'route_blocked',
      kind: 'none',
      reasonAr: 'طلب محظور لأسباب السلامة.',
    },
  },
};

/**
 * Capability Router — routing only. Never bypasses frozen contracts.
 * Never invokes Skin/Face/GI/OI/Styling engines.
 */
export function routeCapability(intent: AdvisorIntent): CapabilityRoute {
  const row = ROUTE_TABLE[intent];
  return { intent, ...row };
}
