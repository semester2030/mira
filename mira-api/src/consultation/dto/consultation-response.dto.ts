import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

export class ConsultationSessionResponseDto {
  id!: string;
  titleAr!: string | null;
  status!: string;
  activeSnapshotId!: string | null;
  contextSummary!: {
    hasSkin: boolean;
    hasOutfit: boolean;
    hasRecolor: boolean;
    occasionId?: string;
  };
  turnCount!: number;
  suggestedStartersAr!: string[];
  createdAt!: string;
  updatedAt!: string;
}

export class ConsultationMessageResponseDto {
  id!: string;
  role!: string;
  contentAr!: string;
  payload?: MceAssistantPayloadV1;
  blocked!: boolean;
  createdAt!: string;
  confidence?: string;
  intent?: string;
  citedFacts?: Array<{ id: string; labelAr: string; valueAr: string }>;
}

export class ConsultationTurnResponseDto {
  userMessage!: ConsultationMessageResponseDto;
  assistantMessage!: ConsultationMessageResponseDto;
  session!: ConsultationSessionResponseDto;
}
