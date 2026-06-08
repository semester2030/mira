import { SkinAnalysisResult } from '../../ai/contracts/skin-analysis-result.interface';
import { SpatialConfidence } from '../contracts/mira-beauty-report.interface';
import {
  ConcernZonesSectionPayload,
  FaceMapPayload,
} from '../contracts/mira-beauty-report.interface';
import {
  FaceHealthInsightCard,
  FaceHealthMapPayload,
  FaceHealthMapZone,
  FaceHealthZoneId,
  FaceMapConfidence,
  FaceMapMode,
} from '../contracts/face_health_map.interface';
import { detectSpatialCapability } from './spatial-spike';

const EDUCATIONAL_HIGHLIGHT = '#C19EE0';
const REGIONAL_HIGHLIGHT = '#A469C9';
const SPATIAL_HIGHLIGHT = '#8E44AD';

const EDUCATIONAL_DISCLAIMER =
  'الخريطة التالية استرشادية وليست تشخيصاً مكانياً دقيقة — المناطق الملوّنة شائعة علمياً وليست «مشكلتك هنا بالضبط».';
const REGIONAL_DISCLAIMER =
  'تم إنشاء الخريطة اعتماداً على تحليل المناطق المختلفة في الوجه — ليست صورة طبية.';
const SPATIAL_DISCLAIMER =
  'تم إنشاء الخريطة اعتماداً على بيانات مكانية من YouCam — zones من المصدر مباشرة.';

const ZONE_LABELS: Record<FaceHealthZoneId, string> = {
  forehead: 'الجبهة',
  under_eye: 'تحت العين',
  cheek_left: 'الخد الأيسر',
  cheek_right: 'الخد الأيمن',
  nose: 'الأنف',
  chin: 'الذقن',
  jawline: 'خط الفك',
  t_zone: 'T-Zone',
};

interface ConcernEducationalRule {
  concernId: string;
  labelAr: string;
  zoneNameAr: string;
  highlightZoneIds: FaceHealthZoneId[];
  threshold: number;
  fallbackScore: (skin: SkinAnalysisResult) => number;
}

const EDUCATIONAL_RULES: ConcernEducationalRule[] = [
  {
    concernId: 'oiliness',
    labelAr: 'إفراز الدهون',
    zoneNameAr: 'T-Zone (الجبهة والأنف والذقن)',
    highlightZoneIds: ['t_zone', 'forehead', 'nose', 'chin'],
    threshold: 60,
    fallbackScore: (s) => 100 - s.oiliness,
  },
  {
    concernId: 'pore',
    labelAr: 'المسام',
    zoneNameAr: 'T-Zone (الأنف والذقن)',
    highlightZoneIds: ['t_zone', 'nose', 'chin'],
    threshold: 58,
    fallbackScore: (s) => 100 - s.pores * 20,
  },
  {
    concernId: 'moisture',
    labelAr: 'الترطيب',
    zoneNameAr: 'منطقة الخدين',
    highlightZoneIds: ['cheek_left', 'cheek_right'],
    threshold: 58,
    fallbackScore: (s) => s.hydration,
  },
  {
    concernId: 'redness',
    labelAr: 'الاحمرار',
    zoneNameAr: 'منتصف الوجه والخدين',
    highlightZoneIds: ['cheek_left', 'cheek_right', 'nose'],
    threshold: 55,
    fallbackScore: (s) => 100 - s.redness * 20,
  },
  {
    concernId: 'dark_circle',
    labelAr: 'الهالات',
    zoneNameAr: 'تحت العين',
    highlightZoneIds: ['under_eye'],
    threshold: 58,
    fallbackScore: () => 72,
  },
  {
    concernId: 'age_spot',
    labelAr: 'التصبغات',
    zoneNameAr: 'الخدين والجبهة',
    highlightZoneIds: ['cheek_left', 'cheek_right', 'forehead'],
    threshold: 58,
    fallbackScore: (s) => 100 - s.darkSpots * 20,
  },
];

export interface FaceMapBundle {
  spatialConfidence: SpatialConfidence;
  faceMap: FaceMapPayload;
  faceHealthMap: FaceHealthMapPayload;
  concernZonesSection: ConcernZonesSectionPayload;
  concernZonesNarrative: string[];
}

export function buildFaceMapBundle(
  skin: SkinAnalysisResult,
  rawYouCam?: unknown,
): FaceMapBundle {
  const spike = detectSpatialCapability(rawYouCam ?? { results: { output: [] } });

  if (spike.verdict === '5b-true-pixel') {
    return buildSpatialBundle(skin, 'pixel', 'spatial', 'high');
  }
  if (spike.verdict === '5b-true-regional') {
    return buildSpatialBundle(skin, 'regional', 'regional', 'medium');
  }

  return buildEducationalBundle(skin);
}

function buildEducationalBundle(skin: SkinAnalysisResult): FaceMapBundle {
  const triggered = collectTriggeredConcerns(skin);
  const highlightIds = new Set<FaceHealthZoneId>();
  const insightCards: FaceHealthInsightCard[] = [];

  for (const rule of triggered) {
    for (const z of rule.highlightZoneIds) highlightIds.add(z);
    insightCards.push(buildInsightCard(rule, skin));
  }

  const zones = buildAllFaceZones(highlightIds, 'educational', EDUCATIONAL_HIGHLIGHT);
  const concernZones = buildConcernZonesFromInsights(insightCards);

  const faceHealthMap: FaceHealthMapPayload = {
    enabled: insightCards.length > 0,
    confidence: 'low',
    confidenceLabelAr: 'ثقة منخفضة — استرشادي',
    mode: 'educational',
    titleAr: 'خريطة الوجه الاسترشادية',
    subtitleAr: 'مناطق شائعة — وليست تشخيصاً مؤكداً على وجهك',
    disclaimerAr: EDUCATIONAL_DISCLAIMER,
    zones,
    insightCards: insightCards.slice(0, 4),
  };

  return {
    spatialConfidence: 'none',
    faceMap: { enabled: false, zones: [] },
    faceHealthMap,
    concernZonesSection: {
      enabled: concernZones.length > 0,
      mode: 'narrative_only',
      spatialConfidence: 'none',
      titleAr: 'مناطق الاهتمام (تقدير عام)',
      disclaimerAr: EDUCATIONAL_DISCLAIMER,
      zones: concernZones,
    },
    concernZonesNarrative: concernZones.map((z) => z.narrativeAr),
  };
}

function buildSpatialBundle(
  skin: SkinAnalysisResult,
  spatialConfidence: SpatialConfidence,
  mode: FaceMapMode,
  confidence: FaceMapConfidence,
): FaceMapBundle {
  const triggered = collectTriggeredConcerns(skin);
  const highlightIds = new Set<FaceHealthZoneId>();
  const insightCards: FaceHealthInsightCard[] = [];

  for (const rule of triggered) {
    for (const z of rule.highlightZoneIds) highlightIds.add(z);
    insightCards.push(buildInsightCard(rule, skin, mode !== 'educational'));
  }

  const highlightColor =
    confidence === 'high' ? SPATIAL_HIGHLIGHT : REGIONAL_HIGHLIGHT;
  const zones = buildAllFaceZones(highlightIds, 'perfect_corp', highlightColor);
  const concernZones = buildConcernZonesFromInsights(insightCards);

  const confidenceLabelAr =
    confidence === 'high'
      ? 'ثقة عالية — تحليل مكاني'
      : 'ثقة متوسطة — تحليل مناطقي';

  const disclaimerAr =
    confidence === 'high' ? SPATIAL_DISCLAIMER : REGIONAL_DISCLAIMER;

  const faceHealthMap: FaceHealthMapPayload = {
    enabled: true,
    confidence,
    confidenceLabelAr,
    mode,
    titleAr: 'خريطة صحة الوجه',
    subtitleAr:
      confidence === 'high'
        ? 'بيانات مكانية من YouCam'
        : 'تحليل مناطقي من YouCam',
    disclaimerAr,
    zones,
    insightCards: insightCards.slice(0, 4),
  };

  return {
    spatialConfidence,
    faceMap: { enabled: true, zones: [] },
    faceHealthMap,
    concernZonesSection: {
      enabled: concernZones.length > 0,
      mode: 'spatial_map',
      spatialConfidence,
      titleAr: 'مناطق الاهتمام',
      disclaimerAr,
      zones: concernZones,
    },
    concernZonesNarrative: concernZones.map((z) => z.narrativeAr),
  };
}

function collectTriggeredConcerns(skin: SkinAnalysisResult): ConcernEducationalRule[] {
  return EDUCATIONAL_RULES.filter((rule) => {
    const ui = uiScore(skin, rule.concernId, rule.fallbackScore(skin));
    return ui < rule.threshold;
  });
}

function buildInsightCard(
  rule: ConcernEducationalRule,
  skin: SkinAnalysisResult,
  spatial = false,
): FaceHealthInsightCard {
  const ui = uiScore(skin, rule.concernId, rule.fallbackScore(skin));
  const severityWord = severityLabel(ui);

  const bodyAr = spatial
    ? `تحليل YouCam يشير إلى ${rule.labelAr} ${severityWord} — مع تركيز محتمل في ${rule.zoneNameAr}.`
    : `بناءً على نتيجة ${rule.labelAr} ${severityWord}، غالباً ما تظهر هذه المشكلة في ${rule.zoneNameAr} — منطقة شائعة وليست تشخيصاً مؤكداً على وجهك.`;

  return {
    id: `insight_${rule.concernId}`,
    concernId: rule.concernId,
    concernLabelAr: rule.labelAr,
    zoneIds: rule.highlightZoneIds,
    zoneLabelAr: rule.zoneNameAr,
    bodyAr,
  };
}

function buildAllFaceZones(
  highlightIds: Set<FaceHealthZoneId>,
  source: 'educational' | 'perfect_corp',
  highlightColor: string,
): FaceHealthMapZone[] {
  const baseZoneIds: FaceHealthZoneId[] = [
    'forehead',
    'under_eye',
    'cheek_left',
    'cheek_right',
    'nose',
    'chin',
    'jawline',
  ];

  const zones: FaceHealthMapZone[] = baseZoneIds.map((id) => ({
    id,
    labelAr: ZONE_LABELS[id],
    highlight: highlightIds.has(id) || (id !== 'jawline' && highlightIds.has('t_zone') && ['forehead', 'nose', 'chin'].includes(id)),
    highlightColor,
    concernIds: [],
    source,
  }));

  if (highlightIds.has('t_zone')) {
    zones.push({
      id: 't_zone',
      labelAr: ZONE_LABELS.t_zone,
      highlight: true,
      highlightColor,
      concernIds: [],
      educationalNoteAr: 'منطقة T-Zone — شائعة للدهون والمسام',
      source,
    });
  }

  return zones;
}

function buildConcernZonesFromInsights(
  cards: FaceHealthInsightCard[],
): ConcernZonesSectionPayload['zones'] {
  return cards.map((card) => ({
    id: card.id,
    zoneLabelAr: card.zoneLabelAr,
    narrativeAr: card.bodyAr,
    concernIds: [card.concernId],
  }));
}

function uiScore(
  skin: SkinAnalysisResult,
  id: string,
  fallback: number,
): number {
  return skin.concernScores?.[id] ?? fallback;
}

function severityLabel(uiScore: number): string {
  if (uiScore >= 50) return 'بدرجة متوسطة';
  return 'بدرجة ملحوظة';
}
