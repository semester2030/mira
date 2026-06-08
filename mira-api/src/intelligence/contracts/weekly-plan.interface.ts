export interface WeeklyPlanDay {
  dayIndex: number;
  labelAr: string;
  focusAr: string;
  stepsAr: string[];
}

export interface WeeklyPlanPayload {
  enabled: boolean;
  headlineAr: string;
  summaryAr: string;
  days: WeeklyPlanDay[];
}

export const WEEKLY_PLAN_EMPTY: WeeklyPlanPayload = {
  enabled: false,
  headlineAr: '',
  summaryAr: '',
  days: [],
};
