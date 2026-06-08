export type AdvisorConfidence = 'high' | 'medium' | 'low';

export interface AdvisorChatResponse {
  answer: string;
  suggestedQuestions: string[];
  confidence: AdvisorConfidence;
  intent: string;
  blocked?: boolean;
  disclaimerAr?: string;
}

export const ADVISOR_DISCLAIMER_AR =
  'نصيحة عناية عامة من ميرا — ليست تشخيصاً طبياً ولا وصفة علاجية.';
