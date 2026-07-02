import { Injectable } from '@nestjs/common';
import {
  MceAssistantPayloadV1,
  MceContextSnapshotV1,
  MceFactEntry,
} from '../contracts/mce-context-snapshot.v1';
import { MceModerationService } from './mce-moderation.service';
import { MceConsultationIntent } from './mce-intent-classifier.service';

@Injectable()
export class McePromptAssemblerService {
  constructor(private readonly moderation: MceModerationService) {}

  buildMessages(input: {
    snapshot: MceContextSnapshotV1;
    factRegistry: MceFactEntry[];
    rollingSummary?: string | null;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    detectedIntent?: MceConsultationIntent;
    intentHintAr?: string;
  }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
    const system = [
      'أنتِ ميرا — مستشارة جمال وأزياء سعودية. تتحدثين بالعربية الفصحى البسيطة بأسلوب دافئ.',
      'قواعد صارمة:',
      '١) لا تشخّصي طبياً ولا توصفي أدوية.',
      '٢) لا تُعيدي تحليل الصورة — استخدمي فقط حقائق CONTEXT.',
      '٣) إن لم تتوفر حقيقة، قولي: «لا تتوفر لدي بيانات كافية في تقريركِ».',
      '٤) لا تُخترعي درجات أو أرقاماً غير موجودة في CONTEXT.',
      '٥) أجيبي بصيغة JSON فقط بالمفاتيح: answerAr, confidence, intent, citedFactIds, suggestedQuestionsAr, blocked, disclaimerAr.',
      '',
      'CONTEXT:',
      this.formatContext(input.snapshot, input.factRegistry),
    ];

    if (input.detectedIntent) {
      system.push('', `نية السؤال المتوقعة: ${input.detectedIntent}`);
      if (input.intentHintAr) {
        system.push(input.intentHintAr);
      }
    }

    if (input.rollingSummary) {
      system.push('', 'ملخص المحادثة السابقة:', input.rollingSummary);
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: system.join('\n') },
    ];

    for (const h of input.history.slice(-8)) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: input.userMessage });

    return messages;
  }

  private formatContext(snapshot: MceContextSnapshotV1, facts: MceFactEntry[]): string {
    const lines: string[] = [];
    if (snapshot.skin) {
      const s = snapshot.skin;
      lines.push(`[بشرة] درجة: ${s.beautyScore} · نوع: ${s.skinTypeAr}`);
      lines.push(`عنوان: ${s.headlineAr}`);
      lines.push(`ملخص: ${s.summaryAdviceAr}`);
      if (s.mainConcerns.length) {
        lines.push(
          `اهتمامات: ${s.mainConcerns.map((c) => `${c.titleAr}(${c.severity})`).join(' · ')}`,
        );
      }
      if (s.routineMorningAr.length) {
        lines.push(`روتين صباح: ${s.routineMorningAr.join(' · ')}`);
      }
      if (s.routineEveningAr.length) {
        lines.push(`روتين مساء: ${s.routineEveningAr.join(' · ')}`);
      }
    }
    if (snapshot.outfit) {
      const o = snapshot.outfit;
      lines.push(
        `[إطلالة] تناسق: ${o.compatibilityScore}% · ألوان: ${o.colorHarmonyScore}% · مناسبة: ${o.occasionMatchScore}%`,
      );
      lines.push(`قطعة: ${o.clothingTypeAr} · أسلوب: ${o.styleTypeAr}`);
      if (o.dominantColorsAr.length) {
        lines.push(`ألوان سائدة: ${o.dominantColorsAr.join(' · ')}`);
      }
      if (o.styleVerdictAr) {
        lines.push(`حكم الأسلوب: ${o.styleVerdictAr}`);
      }
      if (o.matchReasonsAr.length) {
        lines.push(`نقاط قوة: ${o.matchReasonsAr.slice(0, 3).join(' · ')}`);
      }
      if (o.mismatchReasonsAr.length) {
        lines.push(`تحسينات: ${o.mismatchReasonsAr.slice(0, 3).join(' · ')}`);
      }
      if (o.suggestedAccessoriesAr?.length) {
        lines.push(`إكسسوارات: ${o.suggestedAccessoriesAr.join(' · ')}`);
      }
      if (o.suggestedMakeupAr) {
        lines.push(`مكياج مقترح: ${o.suggestedMakeupAr}`);
      }
      if (o.analysisGate && o.analysisGate !== 'proceed') {
        lines.push(
          `تنبيه: تحليل الإطلالة بحالة «${o.analysisGate}» — اذكري ذلك إن سُئلتِ عن الثقة.`,
        );
      }
    }
    if (snapshot.atelier) {
      const a = snapshot.atelier;
      lines.push(
        `[Atelier] ${a.garmentLabelAr} → ${a.targetColorAr} · QEL: ${a.qelGate === 'accept' ? 'مقبول' : 'مرفوض'}`,
      );
      if (a.regionRole) {
        lines.push(`منطقة القطعة: ${a.regionRole}`);
      }
      if (a.qelScores?.identityScore != null) {
        lines.push(`هوية/وجه: ${a.qelScores.identityScore.toFixed(2)} — يجب ألا يُمس الوجه`);
      }
      if (a.qelScores?.weightedScore != null) {
        lines.push(`درجة QEL: ${a.qelScores.weightedScore.toFixed(2)}`);
      }
      if (a.rejectReasonAr) {
        lines.push(`سبب الرفض: ${a.rejectReasonAr}`);
      }
      lines.push('نطاق: تلوين قماش فقط — لا إعادة توليد ولا تغيير قصّة');
    }
    if (snapshot.occasionId) {
      lines.push(`مناسبة الجلسة: ${snapshot.occasionId}`);
    }
    lines.push('', 'سجل الحقائق (للاستشهاد):');
    for (const f of facts.slice(0, 24)) {
      lines.push(`- ${f.id}: ${f.labelAr} = ${f.valueAr}`);
    }
    if (snapshot.user.statedGoalAr) {
      lines.push('', `هدف المستخدمة: ${snapshot.user.statedGoalAr}`);
    }
    return lines.join('\n');
  }
}

@Injectable()
export class MceResponseValidatorService {
  constructor(private readonly moderation: MceModerationService) {}

  validate(
    raw: MceAssistantPayloadV1,
    factRegistry: MceFactEntry[],
  ): MceAssistantPayloadV1 {
    const allowed = new Set(factRegistry.map((f) => f.id));
    const cited = (raw.citedFactIds ?? []).filter((id) => allowed.has(id));

    let confidence = raw.confidence ?? 'medium';
    if (cited.length === 0 && !raw.blocked) {
      confidence = 'low';
    }

    return {
      answerAr: String(raw.answerAr ?? '').trim() || 'عذراً، لم أتمكن من صياغة إجابة واضحة.',
      confidence,
      intent: String(raw.intent ?? 'general'),
      citedFactIds: cited,
      suggestedQuestionsAr: Array.isArray(raw.suggestedQuestionsAr)
        ? raw.suggestedQuestionsAr.slice(0, 4).map(String)
        : [],
      blocked: Boolean(raw.blocked),
      disclaimerAr: raw.disclaimerAr?.trim() || this.moderation.disclaimer(),
    };
  }

  blockedPayload(safeReply: string): MceAssistantPayloadV1 {
    return {
      answerAr: safeReply,
      confidence: 'high',
      intent: 'blocked',
      citedFactIds: [],
      suggestedQuestionsAr: [
        'كيف أحافظ على نتائج التحليل؟',
        'ما أفضل خطوة في روتيني؟',
        'ما المنتجات المناسبة لي؟',
      ],
      blocked: true,
      disclaimerAr: this.moderation.disclaimer(),
    };
  }
}
