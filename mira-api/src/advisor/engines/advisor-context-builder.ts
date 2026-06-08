import { MiraBeautyReport } from '../../intelligence/contracts/mira-beauty-report.interface';
import { AdvisorContext } from '../contracts/advisor-context.interface';

export function buildAdvisorContext(
  analysisId: string,
  report: MiraBeautyReport,
  options?: { userAge?: number | null; birthYear?: number | null },
): AdvisorContext {
  const userAge =
    options?.userAge ??
    (options?.birthYear != null
      ? new Date().getFullYear() - options.birthYear
      : report.ageComparison.userAge ?? undefined);

  const progressSummary = summarizeProgress(report);

  return {
    analysisId,
    report,
    userAge,
    skinAge: report.skinAgeEstimate,
    skinTypeAr: report.skinTypeAr,
    skinTypeEn: report.skinTypeEn,
    mainConcernIds: report.mainConcerns.map((c) => c.id),
    mainConcernLabels: report.mainConcerns.map((c) => c.titleAr),
    routineMorning: report.dailyRoutine.morning.map((s) => s.nameAr),
    routineEvening: report.dailyRoutine.evening.map((s) => s.nameAr),
    products: report.recommendedProducts.map((p) => ({
      id: p.id,
      nameAr: p.nameAr,
      stepAr: p.stepAr ?? undefined,
      matchScore: p.matchScore,
    })),
    progressSummary,
    weeklyHeadline: report.weeklyPlan.enabled
      ? report.weeklyPlan.headlineAr
      : undefined,
    isMinor: report.childSafety.isMinor,
  };
}

function summarizeProgress(report: MiraBeautyReport): string | undefined {
  const pf = report.progressForecast;
  if (!pf.enabled || pf.trends.length === 0) return undefined;

  const improved = pf.trends.filter((t) => t.direction === 'improved');
  if (improved.length === 0) return pf.summaryAr || undefined;

  return improved
    .slice(0, 2)
    .map((t) => `${t.labelAr}: ${t.messageAr}`)
    .join(' · ');
}
