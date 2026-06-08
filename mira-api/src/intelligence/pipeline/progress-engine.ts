import {
  ConcernNarrative,
  ConcernSeverity,
  ProgressForecastPayload,
  ProgressMetricTrend,
  ProgressMilestone,
  ProgressTimelinePoint,
  MiraBeautyReport,
} from '../contracts/mira-beauty-report.interface';

const SEVERITY_SCORE: Record<ConcernSeverity, number> = {
  none: 88,
  mild: 74,
  moderate: 58,
  noticeable: 42,
};

const METRIC_LABELS: Record<string, string> = {
  moisture: 'الترطيب',
  pore: 'المسام',
  redness: 'الاحمرار',
  overall: 'مؤشر الجمال',
};

export interface ProgressHistoryEntry {
  id: string;
  createdAt: Date;
  miraReport: MiraBeautyReport;
}

function concernScore(
  concerns: ConcernNarrative[],
  id: string,
): number {
  const match = concerns.find((c) => c.id === id);
  if (!match) return 70;
  return SEVERITY_SCORE[match.severity];
}

function directionFromDelta(
  delta: number,
): 'improved' | 'regressed' | 'stable' {
  if (delta >= 3) return 'improved';
  if (delta <= -3) return 'regressed';
  return 'stable';
}

function trendMessage(
  labelAr: string,
  delta: number,
  direction: 'improved' | 'regressed' | 'stable',
): string {
  if (direction === 'stable') {
    return `${labelAr} مستقر تقريباً`;
  }
  const abs = Math.abs(delta);
  if (direction === 'improved') {
    return `تحسّن ${labelAr} +${abs} نقطة`;
  }
  return `تراجع ${labelAr} ${abs} نقطة — راجعي روتينك`;
}

function buildTrend(
  id: 'moisture' | 'pore' | 'redness' | 'overall',
  previousScore: number,
  currentScore: number,
): ProgressMetricTrend {
  const deltaPoints = currentScore - previousScore;
  const direction = directionFromDelta(deltaPoints);
  const labelAr = METRIC_LABELS[id] ?? id;
  return {
    id,
    labelAr,
    previousScore,
    currentScore,
    deltaPoints,
    direction,
    messageAr: trendMessage(labelAr, deltaPoints, direction),
  };
}

function buildMilestones(
  history: ProgressHistoryEntry[],
  trends: ProgressMetricTrend[],
): ProgressMilestone[] {
  const milestones: ProgressMilestone[] = [];

  if (history.length >= 1) {
    milestones.push({
      id: 'first_scan',
      titleAr: 'أول تحليل ✨',
      descriptionAr: 'بدأتِ رحلة متابعة بشرتك مع ميرا.',
    });
  }

  if (history.length >= 2) {
    milestones.push({
      id: 'second_scan',
      titleAr: 'متابعة منتظمة',
      descriptionAr: 'تحليلان أو أكثر — Trends أصبحت متاحة.',
    });
  }

  for (const trend of trends) {
    if (trend.direction === 'improved' && trend.deltaPoints >= 8) {
      milestones.push({
        id: `milestone_${trend.id}`,
        titleAr: trend.messageAr,
        descriptionAr: `من ${trend.previousScore} إلى ${trend.currentScore} — استمري على هذا الروتين.`,
      });
    }
  }

  const overall = trends.find((t) => t.id === 'overall');
  if (overall && overall.direction === 'improved' && overall.deltaPoints >= 5) {
    milestones.push({
      id: 'beauty_score_up',
      titleAr: 'ارتفع مؤشر جمال بشرتك',
      descriptionAr: overall.messageAr,
    });
  }

  return milestones.slice(0, 5);
}

function linearProjection30Days(
  timeline: ProgressTimelinePoint[],
): number | undefined {
  if (timeline.length < 2) return undefined;

  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const firstDate = new Date(first.createdAt).getTime();
  const lastDate = new Date(last.createdAt).getTime();
  const daySpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
  const slope = (last.overallScore - first.overallScore) / daySpan;
  const projected = last.overallScore + slope * 30;
  return Math.round(Math.min(100, Math.max(0, projected)));
}

export function buildProgressForecast(
  history: ProgressHistoryEntry[],
): ProgressForecastPayload {
  const scanCount = history.length;
  const sorted = [...history].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const timeline: ProgressTimelinePoint[] = sorted.map((entry) => ({
    analysisId: entry.id,
    createdAt: entry.createdAt.toISOString(),
    overallScore: entry.miraReport.overallBeautyScore,
  }));

  if (scanCount < 2) {
    return {
      enabled: false,
      scanCount,
      needsMoreScans: true,
      headlineAr: 'تابعي تقدمك',
      summaryAr:
        'بعد تحليل ثانٍ ستظهر Trends ومقارنة بين زيارتك — استمري على الروتين.',
      timeline,
      trends: [],
      milestones: buildMilestones(sorted, []),
    };
  }

  const previous = sorted[sorted.length - 2];
  const current = sorted[sorted.length - 1];

  const trends: ProgressMetricTrend[] = [
    buildTrend(
      'overall',
      previous.miraReport.overallBeautyScore,
      current.miraReport.overallBeautyScore,
    ),
    buildTrend(
      'moisture',
      concernScore(previous.miraReport.mainConcerns, 'moisture'),
      concernScore(current.miraReport.mainConcerns, 'moisture'),
    ),
    buildTrend(
      'pore',
      concernScore(previous.miraReport.mainConcerns, 'pore'),
      concernScore(current.miraReport.mainConcerns, 'pore'),
    ),
    buildTrend(
      'redness',
      concernScore(previous.miraReport.mainConcerns, 'redness'),
      concernScore(current.miraReport.mainConcerns, 'redness'),
    ),
  ];

  const improved = trends.filter((t) => t.direction === 'improved');
  const headlineAr =
    improved.length > 0
      ? improved[0].messageAr
      : 'مقارنة بين آخر تحليلين';

  const projectedOverallScore30Days = linearProjection30Days(timeline);
  const summaryAr = projectedOverallScore30Days
    ? `إذا استمررتِ على روتينك، قد يصل مؤشرك إلى ${projectedOverallScore30Days} خلال 30 يوماً (تقدير خطي).`
    : 'قارنا آخر تحليلين — راجعي Trends أدناه.';

  return {
    enabled: true,
    scanCount,
    needsMoreScans: false,
    headlineAr,
    summaryAr,
    timeline,
    trends,
    milestones: buildMilestones(sorted, trends),
    projectedOverallScore30Days,
  };
}
