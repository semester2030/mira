import { MiraBeautyReport } from '../../intelligence/contracts/mira-beauty-report.interface';

export interface AdvisorProductContext {
  id: string;
  nameAr: string;
  stepAr?: string;
  matchScore: number;
}

/** Structured facts for advisor engines — no raw YouCam metrics. */
export interface AdvisorContext {
  analysisId: string;
  report: MiraBeautyReport;
  userAge?: number;
  skinAge?: number;
  skinTypeAr: string;
  skinTypeEn: string;
  mainConcernIds: string[];
  mainConcernLabels: string[];
  routineMorning: string[];
  routineEvening: string[];
  products: AdvisorProductContext[];
  progressSummary?: string;
  weeklyHeadline?: string;
  isMinor: boolean;
}
