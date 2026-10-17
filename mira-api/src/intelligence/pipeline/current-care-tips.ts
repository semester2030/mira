import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { ConcernSeverity, MiraBeautyReport } from '../contracts/mira-beauty-report.interface';
import { DailyRoutinePlan, RoutineStep } from '../contracts/mira-beauty-report.interface';
import { WeeklyPlanPayload } from '../contracts/weekly-plan.interface';
import { currentConcernNarrative } from './narrative-engine';
import { buildRoutineFromKnownScores } from './treatment-plan-engine';
import { buildWeeklyPlanFromKnownScores } from './weekly-plan-engine';

const DAILY = 'روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.';
const HYDRATION = 'زيدي الترطيب بسيروم أو كريم يحتوي على حمض الهيالورونيك.';
const OIL_FREE = 'استخدمي منظفًا خفيفًا غير كوميدوجينيك ومنتجات oil-free.';
const PORES = 'للمسام الظاهرة: تنظيف لطيف دون الإفراط في المقشرات. اختيار المقشر يكون مع مختص عند الحاجة.';
const ACNE = 'إذا ظهرت حبوب، التنظيف اللطيف وعدم لمسها مفيد. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.';
const WRINKLES = 'واقي الشمس يوميًا أساسي. الخطوط الدقيقة تُراجع مع مختص عند الحاجة، دون جدول استخدام من التقرير.';
const SPOTS = 'فيتامين C صباحًا قد يساعد على توحيد لون البشرة تدريجيًا.';
const REDNESS = 'تجنبي الحرارة والمنتجات القاسية؛ مرطبات مهدئة للاحمرار.';

const ENGLISH: Record<string, string> = {
  [DAILY]: 'Daily routine: gentle cleanse, moisturize, and sunscreen.',
  [HYDRATION]: 'Boost hydration with hyaluronic acid serum or cream.',
  [OIL_FREE]: 'Use a light non-comedogenic cleanser and oil-free products.',
  [PORES]: 'For visible pores: cleanse gently and avoid over-exfoliating. A specialist can choose an exfoliant if needed.',
  [ACNE]: 'If blemishes appear, gentle cleansing and not touching them helps. Treatment decisions belong with a specialist, not the photo.',
  [WRINKLES]: 'Daily sunscreen is essential. Fine lines can be reviewed with a specialist; the report does not set a treatment schedule.',
  [SPOTS]: 'Morning vitamin C may gradually even skin tone.',
  [REDNESS]: 'Avoid heat and harsh products; soothing moisturizers for redness.',
};

export function currentCareTipsAr(metrics: {
  hydration: number;
  oiliness: number;
  pores: number;
  wrinkles: number;
  acne: number;
  darkSpots: number;
  redness: number;
}): string[] {
  const tips = [DAILY];
  if (metrics.hydration < 55) tips.push(HYDRATION);
  if (metrics.oiliness <= 35) tips.push(OIL_FREE);
  if (metrics.pores >= 3) tips.push(PORES);
  if (metrics.acne >= 3) tips.push(ACNE);
  if (metrics.wrinkles >= 3) tips.push(WRINKLES);
  if (metrics.darkSpots >= 3) tips.push(SPOTS);
  if (metrics.redness >= 3) tips.push(REDNESS);
  return tips.slice(0, 5);
}

export function currentCareTipsEn(tipsAr: string[]): string[] {
  return tipsAr.map((tip) => ENGLISH[tip] ?? tip);
}

export function tipsFromSkinResult(skin: SkinAnalysisResult): string[] {
  return currentCareTipsAr({
    hydration: skin.hydration,
    oiliness: skin.oiliness,
    pores: skin.pores,
    wrinkles: skin.wrinkles,
    acne: skin.acne,
    darkSpots: skin.darkSpots,
    redness: skin.redness,
  });
}

export function presentCurrentSkinAdvice<T extends SkinAnalysisResult>(skin: T): T {
  const recommendationsAr = tipsFromSkinResult(skin);
  return {
    ...skin,
    recommendationsAr,
    recommendationsEn: currentCareTipsEn(recommendationsAr),
  };
}

function concernTip(id: string, severity: ConcernSeverity): string | null {
  const active = severity === 'moderate' || severity === 'noticeable';
  if (!active) return null;
  if (id === 'acne') return ACNE;
  if (id === 'wrinkle') return WRINKLES;
  if (id === 'pore' && severity === 'noticeable') return PORES;
  return null;
}

const LEGACY_DOSE = /BHA|BPO|ريتينويد|retinoid|benzoyl|ساليسيليك/i;
const GENERAL_ADVICE =
  'اتبعي روتينًا لطيفًا وثابتًا. تقييم أي علاج يكون مع مختص، وليس من صورة التحليل.';
const GENERAL_STEP =
  'تنظيف لطيف وترطيب. اختيار المقشر أو العلاج يكون مع مختص، وليس من صورة التحليل.';

function scrubLegacyDose(text: string | undefined): string {
  if (!text) return text ?? '';
  return LEGACY_DOSE.test(text) ? GENERAL_ADVICE : text;
}

function finiteScore(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Measured scores already stored on the report. Severity labels are not scores. */
export function knownSourceScores(report: MiraBeautyReport): Record<string, number> {
  const scores: Record<string, number> = {};
  const put = (id: string | undefined, value: unknown) => {
    const score = finiteScore(value);
    if (!id || score == null) return;
    const key = id === 'hydration' ? 'moisture' : id;
    if (scores[key] != null) return;
    scores[key] = score;
  };
  for (const overlay of report.faceHealthMap?.concernOverlays ?? []) {
    put(overlay.concernId, overlay.globalScore);
  }
  for (const metric of report.skinIntelligence?.metrics ?? []) {
    if (metric.availability === 'available') put(metric.id, metric.normalizedValue);
  }
  return scores;
}

function generalRoutine(): DailyRoutinePlan {
  return buildRoutineFromKnownScores({});
}

function softenStep(step: RoutineStep): RoutineStep {
  const blob = `${step.nameAr} ${step.nameEn} ${step.stepAr}`;
  if (!LEGACY_DOSE.test(blob)) return step;
  return {
    ...step,
    nameAr: 'عناية لطيفة',
    nameEn: 'Gentle care',
    stepAr: GENERAL_STEP,
  };
}

function presentRoutine(report: MiraBeautyReport, scores: Record<string, number>): DailyRoutinePlan {
  if (Object.keys(scores).length > 0) return buildRoutineFromKnownScores(scores);
  const morning = (report.dailyRoutine?.morning ?? []).map(softenStep);
  const evening = (report.dailyRoutine?.evening ?? []).map(softenStep);
  if (morning.length === 0 && evening.length === 0) return generalRoutine();
  const base = generalRoutine();
  return {
    morning: morning.length > 0 ? morning : base.morning,
    evening: evening.length > 0 ? evening : base.evening,
  };
}

function presentWeekly(report: MiraBeautyReport, scores: Record<string, number>, routine: DailyRoutinePlan): WeeklyPlanPayload {
  if (Object.keys(scores).length > 0) return buildWeeklyPlanFromKnownScores(scores, routine);
  const days = (report.weeklyPlan?.days ?? []).map((day) => ({
    ...day,
    focusAr: scrubLegacyDose(day.focusAr),
    stepsAr: (day.stepsAr ?? []).map((step) => (LEGACY_DOSE.test(step) ? GENERAL_STEP : step)),
  }));
  if (days.length === 0) return buildWeeklyPlanFromKnownScores({}, routine);
  return {
    ...(report.weeklyPlan ?? { enabled: true, headlineAr: '', summaryAr: '' }),
    days,
    summaryAr: scrubLegacyDose(report.weeklyPlan?.summaryAr),
    headlineAr: scrubLegacyDose(report.weeklyPlan?.headlineAr),
  };
}

export function presentCurrentReportTips(report: MiraBeautyReport): MiraBeautyReport {
  const mainConcerns = (report.mainConcerns ?? []).map((concern) => ({
    ...concern,
    narrativeAr: currentConcernNarrative(concern.id, concern.severity) ?? scrubLegacyDose(concern.narrativeAr),
  }));
  const scores = knownSourceScores(report);
  const dailyRoutine = presentRoutine(report, scores);
  const weeklyPlan = presentWeekly(report, scores, dailyRoutine);
  const tips = [DAILY];
  for (const concern of mainConcerns) {
    const tip = concernTip(concern.id, concern.severity);
    if (tip) tips.push(tip);
  }
  const tipsAr = [...new Set(tips)].slice(0, 5);
  const shown = {
    ...report,
    mainConcerns,
    dailyRoutine,
    weeklyPlan,
    tipsAr,
    summaryAdviceAr: scrubLegacyDose(report.summaryAdviceAr),
    headlineAr: scrubLegacyDose(report.headlineAr),
  };
  const extra = report as MiraBeautyReport & { recommendationsAr?: string[]; recommendationsEn?: string[] };
  if (extra.recommendationsAr || extra.recommendationsEn) {
    return {
      ...shown,
      recommendationsAr: tipsAr,
      recommendationsEn: currentCareTipsEn(tipsAr),
    } as MiraBeautyReport;
  }
  return shown;
}
