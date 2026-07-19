import { Injectable } from '@nestjs/common';
import { MiraBeautyReport } from '../../intelligence/contracts/mira-beauty-report.interface';
import {
  MceConfidenceLevel,
  MceFactEntry,
  MCE_CONTEXT_SCHEMA_VERSION,
  MceContextSnapshotV1,
  OutfitContextSummaryV1,
  SkinContextSummaryV1,
  AtelierContextSummaryV1,
} from '../contracts/mce-context-snapshot.v1';

@Injectable()
export class MceFactExtractorService {
  buildSkinSummary(analysisId: string, report: MiraBeautyReport): SkinContextSummaryV1 {
    const concernScores =
      report.faceHealthMap.concernOverlays?.map((o) => ({
        concernId: o.concernId,
        labelAr: o.labelAr,
        score: o.globalScore,
        severity: o.severity,
      })) ?? [];

    return {
      analysisId,
      beautyScore: report.overallBeautyScore,
      skinTypeAr: report.skinTypeAr,
      skinAgeEstimate: report.skinAgeEstimate,
      headlineAr: report.headlineAr,
      summaryAdviceAr: report.summaryAdviceAr,
      mainConcerns: report.mainConcerns.map((c) => ({
        id: c.id,
        titleAr: c.titleAr,
        severity: c.severity,
      })),
      tipsAr: report.tipsAr.slice(0, 8),
      routineMorningAr: report.dailyRoutine.morning.map((s) => s.nameAr),
      routineEveningAr: report.dailyRoutine.evening.map((s) => s.nameAr),
      concernScores,
      confidenceHeadlineAr: report.confidenceLayer.enabled
        ? report.confidenceLayer.headlineAr
        : undefined,
      disclaimerAr: report.faceHealthMap.disclaimerAr || 'نصيحة عناية عامة — ليست تشخيصاً طبياً.',
      isMinor: report.childSafety.isMinor,
    };
  }

  buildOutfitSummary(summary: OutfitContextSummaryV1): OutfitContextSummaryV1 {
    return summary;
  }

  buildAtelierSummary(summary: AtelierContextSummaryV1): AtelierContextSummaryV1 {
    return summary;
  }

  buildFactRegistry(snapshot: MceContextSnapshotV1): MceFactEntry[] {
    const facts: MceFactEntry[] = [];
    const skin = snapshot.skin;
    if (skin) {
      facts.push({
        id: 'skin.beautyScore',
        labelAr: 'مؤشر حيوية البشرة',
        valueAr: String(skin.beautyScore),
        confidence: 'high',
      });
      facts.push({
        id: 'skin.type',
        labelAr: 'نوع البشرة',
        valueAr: skin.skinTypeAr,
        confidence: 'high',
      });
      facts.push({
        id: 'skin.headline',
        labelAr: 'العنوان',
        valueAr: skin.headlineAr,
        confidence: 'high',
      });
      facts.push({
        id: 'skin.summary',
        labelAr: 'الملخص',
        valueAr: skin.summaryAdviceAr,
        confidence: 'high',
      });
      for (const c of skin.mainConcerns) {
        facts.push({
          id: `skin.concern.${c.id}`,
          labelAr: c.titleAr,
          valueAr: c.severity,
          confidence: 'high',
        });
      }
      for (const s of skin.concernScores) {
        facts.push({
          id: `skin.score.${s.concernId}`,
          labelAr: s.labelAr,
          valueAr: `${s.score}/100 — ${s.severity}`,
          confidence: 'medium' as MceConfidenceLevel,
        });
      }
    }

    const outfit = snapshot.outfit;
    if (outfit) {
      facts.push({
        id: 'outfit.compatibilityScore',
        labelAr: 'تناسق الإطلالة',
        valueAr: `${outfit.compatibilityScore}%`,
        confidence: 'high',
      });
      facts.push({
        id: 'outfit.colorHarmony',
        labelAr: 'تناسق الألوان',
        valueAr: `${outfit.colorHarmonyScore}%`,
        confidence: 'high',
      });
      facts.push({
        id: 'outfit.occasionMatch',
        labelAr: 'ملاءمة المناسبة',
        valueAr: `${outfit.occasionMatchScore}%`,
        confidence: 'high',
      });
      facts.push({
        id: 'outfit.garmentType',
        labelAr: 'نوع القطعة',
        valueAr: outfit.clothingTypeAr,
        confidence: 'high',
      });
      facts.push({
        id: 'outfit.styleType',
        labelAr: 'الأسلوب',
        valueAr: outfit.styleTypeAr,
        confidence: 'high',
      });
      if (outfit.dominantColorsAr.length) {
        facts.push({
          id: 'outfit.dominantColors',
          labelAr: 'الألوان السائدة',
          valueAr: outfit.dominantColorsAr.join(' · '),
          confidence: 'high',
        });
      }
      if (outfit.recommendedColorsAr.length) {
        facts.push({
          id: 'outfit.recommendedColors',
          labelAr: 'ألوان مقترحة',
          valueAr: outfit.recommendedColorsAr.join(' · '),
          confidence: 'medium',
        });
      }
      if (outfit.styleVerdictAr) {
        facts.push({
          id: 'outfit.verdict',
          labelAr: 'حكم الأسلوب',
          valueAr: outfit.styleVerdictAr,
          confidence: 'high',
        });
      }
      for (const [i, reason] of outfit.matchReasonsAr.slice(0, 4).entries()) {
        facts.push({
          id: `outfit.match.${i}`,
          labelAr: 'سبب مطابقة',
          valueAr: reason,
          confidence: 'medium',
        });
      }
      for (const [i, reason] of outfit.mismatchReasonsAr.slice(0, 4).entries()) {
        facts.push({
          id: `outfit.mismatch.${i}`,
          labelAr: 'نقطة تحسين',
          valueAr: reason,
          confidence: 'medium',
        });
      }
      if (outfit.suggestedAccessoriesAr?.length) {
        facts.push({
          id: 'outfit.accessories',
          labelAr: 'إكسسوارات مقترحة',
          valueAr: outfit.suggestedAccessoriesAr.join(' · '),
          confidence: 'medium',
        });
      }
      if (outfit.suggestedMakeupAr) {
        facts.push({
          id: 'outfit.makeup',
          labelAr: 'مكياج مقترح',
          valueAr: outfit.suggestedMakeupAr,
          confidence: 'medium',
        });
      }
      if (outfit.analysisGate && outfit.analysisGate !== 'proceed') {
        facts.push({
          id: 'outfit.analysisGate',
          labelAr: 'حالة التحليل',
          valueAr: outfit.analysisGate,
          confidence: 'high',
        });
      }
    }

    const atelier = snapshot.atelier;
    if (atelier) {
      facts.push({
        id: 'atelier.scope',
        labelAr: 'نطاق التلوين',
        valueAr: 'تلوين قماش فقط — دون إعادة توليد',
        confidence: 'high',
      });
      facts.push({
        id: 'atelier.garment',
        labelAr: 'القطعة',
        valueAr: atelier.garmentLabelAr,
        confidence: 'high',
      });
      facts.push({
        id: 'atelier.targetColor',
        labelAr: 'اللون المطلوب',
        valueAr: atelier.targetColorAr,
        confidence: 'high',
      });
      facts.push({
        id: 'atelier.qel.gate',
        labelAr: 'بوابة QEL',
        valueAr: atelier.qelGate === 'accept' ? 'مقبول' : 'مرفوض',
        confidence: 'high',
      });
      if (atelier.qelScores?.identityScore != null) {
        facts.push({
          id: 'atelier.qel.identity',
          labelAr: 'درجة الحفاظ على الهوية',
          valueAr: atelier.qelScores.identityScore.toFixed(2),
          confidence: 'high',
        });
      }
      if (atelier.qelScores?.weightedScore != null) {
        facts.push({
          id: 'atelier.qel.weighted',
          labelAr: 'درجة QEL المرجّحة',
          valueAr: atelier.qelScores.weightedScore.toFixed(2),
          confidence: 'high',
        });
      }
      if (atelier.rejectReasonAr) {
        facts.push({
          id: 'atelier.qel.rejectReason',
          labelAr: 'سبب الرفض',
          valueAr: atelier.rejectReasonAr,
          confidence: 'high',
        });
      }
    }

    return facts;
  }

  emptySnapshotShell(input: {
    locale: string;
    subscriptionPlan: string;
    birthYear?: number | null;
    isMinor?: boolean;
    statedGoalAr?: string;
    occasionId?: string;
  }): MceContextSnapshotV1 {
    return {
      schemaVersion: MCE_CONTEXT_SCHEMA_VERSION,
      user: {
        locale: input.locale,
        birthYear: input.birthYear ?? undefined,
        isMinor: input.isMinor ?? false,
        subscriptionPlan: input.subscriptionPlan,
        statedGoalAr: input.statedGoalAr,
      },
      occasionId: input.occasionId,
      builtAt: new Date().toISOString(),
    };
  }
}
