import {
  BeautyJourneyPayload,
  ConcernNarrative,
  ConcernSeverity,
  JourneyGoal,
  JourneyPriority,
  MiraBeautyReport,
} from '../contracts/mira-beauty-report.interface';

const SEVERITY_SCORE: Record<ConcernSeverity, number> = {
  none: 88,
  mild: 74,
  moderate: 58,
  noticeable: 42,
};

const GAIN_BY_SEVERITY: Record<ConcernSeverity, number> = {
  none: 0,
  mild: 4,
  moderate: 6,
  noticeable: 8,
};

function concernScore(concern: ConcernNarrative): number {
  return SEVERITY_SCORE[concern.severity];
}

function buildPriorities(concerns: ConcernNarrative[]): JourneyPriority[] {
  const actionable = concerns
    .filter((c) => c.severity !== 'none')
    .sort((a, b) => concernScore(a) - concernScore(b));

  return actionable.slice(0, 3).map((concern, index) => ({
    rank: index + 1,
    concernId: concern.id,
    labelAr: concern.titleAr,
    currentScore: concernScore(concern),
    expectedGainPoints: GAIN_BY_SEVERITY[concern.severity],
    rationaleAr: concern.narrativeAr,
  }));
}

function computeTargetScore(
  current: number,
  projected?: number,
): number {
  if (projected != null && projected > current) {
    return Math.min(100, projected);
  }

  const gap = 100 - current;
  const step =
    current >= 82 ? 3 : current >= 68 ? 5 : Math.min(8, Math.max(5, Math.round(gap * 0.15)));

  return Math.min(100, current + step);
}

function buildNextGoal(report: MiraBeautyReport): JourneyGoal {
  const current = report.overallBeautyScore;
  const target = computeTargetScore(
    current,
    report.progressForecast.projectedOverallScore30Days,
  );
  const horizonDays = 30;

  return {
    metricId: 'overall',
    labelAr: 'مؤشر جمال البشرة',
    currentValue: current,
    targetValue: target,
    horizonDays,
    headlineAr: `هدفنا القادم: الوصول إلى ${target} خلال ${horizonDays} يوماً`,
    summaryAr:
      target > current
        ? `من ${current} إلى ${target} — خطة ميرا الأسبوعية وروتينك اليومي هما الطريق.`
        : `حافظي على ${current}+ — روتينك الحالي يحافظ على توازن بشرتك.`,
  };
}

export function buildBeautyJourney(report: MiraBeautyReport): BeautyJourneyPayload {
  const priorities = buildPriorities(report.mainConcerns);
  const topOpportunity = priorities[0] ?? null;
  const nextGoal = buildNextGoal(report);

  const planSummaryAr = report.weeklyPlan.enabled
    ? `${report.weeklyPlan.summaryAr} — ${report.weeklyPlan.headlineAr}`
    : 'اتبعي روتينك اليومي (صباحاً ومساءً) مع واقي شمس يومياً.';

  const followUpAr = report.progressForecast.needsMoreScans
    ? 'أجري تحليلاً ثانياً بعد 7–14 يوماً — لتفعيل Trends ومتابعة الهدف.'
    : report.progressForecast.summaryAr ||
      'راجعي تقريرك أسبوعياً — ميرا تقارن تقدمك تلقائياً.';

  let headlineAr = 'رحلة عنايتك مع ميرا';
  let summaryAr =
    'نربط حالتك الحالية بهدف واضح — ثم خطة أسبوعية قابلة للمتابعة.';

  if (topOpportunity) {
    headlineAr = `أكبر فرصة للتحسن: ${topOpportunity.labelAr}`;
    summaryAr = `مؤشر ${topOpportunity.labelAr} ${topOpportunity.currentScore} — التحسن المتوقع +${topOpportunity.expectedGainPoints} نقطة مع الروتين المناسب.`;
  }

  if (priorities.length >= 2) {
    summaryAr += ` · الأولوية الثانية: ${priorities[1].labelAr}.`;
  }

  return {
    enabled: true,
    headlineAr,
    summaryAr,
    currentOverallScore: report.overallBeautyScore,
    nextGoal,
    topOpportunity,
    priorities,
    planSummaryAr,
    followUpAr,
  };
}
