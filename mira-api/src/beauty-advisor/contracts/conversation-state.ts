/**
 * Conversation state + intent contracts.
 */
import { ADVISOR_CONVERSATION_VERSION } from '../release';
import type { AdvisorSubsystemId } from './advisor-evidence-envelope';

export type AdvisorIntent =
  | 'skin'
  | 'face'
  | 'wardrobe'
  | 'garment'
  | 'outfit'
  | 'styling'
  | 'beauty_experience'
  | 'goals'
  | 'general'
  | 'unsupported'
  | 'blocked';

export interface ConversationState {
  version: typeof ADVISOR_CONVERSATION_VERSION;
  sessionId: string;
  turnIndex: number;
  lastIntent: AdvisorIntent;
  pendingClarifications: string[];
  openActions: AdvisorActionRoute[];
  lastEnvelopeId?: string;
}

export interface AdvisorActionRoute {
  actionId: string;
  kind:
    | 'request_skin_analysis'
    | 'request_face_analysis'
    | 'bind_wardrobe'
    | 'request_garment'
    | 'request_outfit'
    | 'request_styling'
    | 'open_beauty_experience'
    | 'clarify'
    | 'none';
  targetSubsystem?: AdvisorSubsystemId;
  reasonAr: string;
}

export function emptyConversationState(sessionId: string): ConversationState {
  return {
    version: ADVISOR_CONVERSATION_VERSION,
    sessionId,
    turnIndex: 0,
    lastIntent: 'general',
    pendingClarifications: [],
    openActions: [],
  };
}
