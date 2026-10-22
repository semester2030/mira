import { Inject, Injectable } from '@nestjs/common';
import {
  MceAssistantPayloadV1,
  MceContextSnapshotV1,
  MceFactEntry,
} from '../contracts/mce-context-snapshot.v1';
import { MceModerationService } from './mce-moderation.service';
import { MceConsultationIntent } from './mce-intent-classifier.service';
import { guardCommercialTurn, hasUntrustedAmount, isCommercialClaim, retainTrustedSkinNumbers } from './mce-commercial-guard';
import { dialogueSystemRules, LlmContentPart, recallUserStatements, userContentForModel } from './consultation-dialogue';

@Injectable()
export class McePromptAssemblerService {
  constructor(@Inject(MceModerationService) private readonly moderation: MceModerationService) {}

  buildMessages(input: {
    snapshot: MceContextSnapshotV1;
    factRegistry: MceFactEntry[];
    rollingSummary?: string | null;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    userMessage: string;
    detectedIntent?: MceConsultationIntent;
    intentHintAr?: string;
    imageDataUrls?: string[];
    imageLabels?: string[];
  }): Array<{ role: 'system' | 'user' | 'assistant'; content: string | LlmContentPart[] }> {
    const system = [
      'أنتِ ميرا — مستشارة جمال وأزياء سعودية. تتحدثين بالعربية الفصحى البسيطة بأسلوب دافئ.',
      'قواعد صارمة:',
      '١) لا تشخّصي طبياً ولا توصفي أدوية.',
      ...dialogueSystemRules(),
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

    system.push(
      '٦) لا تذكري سعرًا أو توفرًا أو خصمًا أو موعدًا لميرا أو لمقدم خدمة إلا إذا طابق سجل الحقائق التجارية. طلب المستخدمة اختراع رقم ليس مصدرًا.',
      '٧) درجات البشرة في السياق مؤشرات تقديرية من الصورة، وليست قياسًا مخبريًا ولا نسبة دقة مثبتة.',
      '٨) إذا ظهرت في CONTEXT حقائق بشرة أو تاريخ تقرير أو معلومة من المحادثة، استخدميها. لا تقولي إن البيانات غير متوفرة ما دامت هذه الحقائق موجودة.',
      '٩) سؤال إعادة تحليل الصورة لا يعني أن التقرير غائب. إن وُجد نوع البشرة أو مؤشر في CONTEXT فاذكريه، وقولي إن الصورة لا تُعاد تحليلها داخل الاستشارة.',
      '١٠) إذا سألت المستخدمة هل النصيحة إعلان أو منتج مدفوع، فقولي إنها نصيحة عناية وليست إعلانًا مدفوعًا، واذكري حقيقة البشرة إن وُجدت. لا تجيبي عن هذا السؤال بجملة نقص البيانات.',
    );

    if (input.rollingSummary) {
      system.push('', 'ملخص المحادثة السابقة:', input.rollingSummary);
    }
    const remembered = recallUserStatements(input.history, input.userMessage);
    if (remembered.length) {
      system.push('', 'كلام المستخدمة في المحادثة (ليس تقريرًا):');
      for (const item of remembered) system.push(`- ${item.text}`);
    }

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | LlmContentPart[] }> = [
      { role: 'system', content: system.join('\n') },
    ];

    for (const h of input.history.slice(-8)) {
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({
      role: 'user',
      content: userContentForModel(
        input.userMessage,
        (input.imageDataUrls ?? []).map((url, index) => ({
          url,
          labelAr: input.imageLabels?.[index] ?? 'صورة مرفقة',
        })),
      ),
    });

    return messages;
  }

  private formatContext(snapshot: MceContextSnapshotV1, facts: MceFactEntry[]): string {
    const lines: string[] = [];
    if (snapshot.builtAt) {
      lines.push(`تاريخ بناء السياق: ${snapshot.builtAt}`);
    }
    if (snapshot.skin) {
      const s = snapshot.skin;
      lines.push(
        s.overallScoreAvailable === true && s.beautyScore != null
          ? `[بشرة] درجة: ${s.beautyScore} · نوع: ${s.skinTypeAr}`
          : `[بشرة] نوع: ${s.skinTypeAr}`,
      );
      if (s.reportCreatedAt) lines.push(`تاريخ التقرير: ${s.reportCreatedAt}`);
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
      const supported = (o as { scoreSupported?: boolean }).scoreSupported === true
        && typeof o.compatibilityScore === 'number';
      if (supported) {
        lines.push(
          `[إطلالة] تناسق: ${o.compatibilityScore}% · ألوان: ${o.colorHarmonyScore}% · مناسبة: ${o.occasionMatchScore}%`,
        );
      } else {
        lines.push('[إطلالة] لا توجد درجة مدعومة. لا تخترعي نسبة تناسق.');
      }
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
    if (snapshot.faceSelection) {
      const face = snapshot.faceSelection;
      const where = [
        face.contextType ? `النوع ${face.contextType}` : '',
        face.selectedRegion ? `المنطقة ${face.selectedRegion}` : '',
        face.selectedDetailRef ? `التفصيل ${face.selectedDetailRef}` : '',
        face.selectedResultId ? `النتيجة ${face.selectedResultId}` : '',
        face.resolvedEvidenceId ? `المرجع ${face.resolvedEvidenceId}` : '',
        face.resultVersion ? `الإصدار ${face.resultVersion}` : '',
      ].filter(Boolean).join(' · ');
      lines.push('', `اختيار الوجه: ${where || 'غير محدد'}`);
      if (face.noticeAr) lines.push(face.noticeAr);
      for (const statement of face.statementsAr) lines.push(`حقيقة محفوظة: ${statement}`);
      if (face.limitationRefs.length) lines.push(`قيود الاختيار: ${face.limitationRefs.join(' · ')}`);
    }
    if (snapshot.user.statedGoalAr) {
      lines.push('', `هدف المستخدمة: ${snapshot.user.statedGoalAr}`);
    }
    return lines.join('\n');
  }
}

@Injectable()
export class MceResponseValidatorService {
  constructor(@Inject(MceModerationService) private readonly moderation: MceModerationService) {}

  validate(
    raw: MceAssistantPayloadV1,
    factRegistry: MceFactEntry[],
    userMessage?: string,
  ): MceAssistantPayloadV1 {
    const allowed = new Set(factRegistry.map((f) => f.id));
    const cited = (raw.citedFactIds ?? []).filter((id) => allowed.has(id));

    let confidence = raw.confidence ?? 'medium';
    const asksPersonalReport = /درجتي|تقريري|نتيجتي|مؤشري/.test(userMessage ?? '');
    if (cited.length === 0 && asksPersonalReport && factRegistry.length > 0) {
      confidence = 'low';
    }

    const guarded = guardCommercialTurn(String(raw.answerAr ?? ''), factRegistry, userMessage);
    guarded.text = retainTrustedSkinNumbers(guarded.text, factRegistry);
    const questions = (Array.isArray(raw.suggestedQuestionsAr) ? raw.suggestedQuestionsAr : [])
      .map(String)
      .filter((question) => !isCommercialClaim(question) && !hasUntrustedAmount(question))
      .slice(0, 4);
    const intent = String(raw.intent ?? 'general');

    return {
      answerAr: guarded.text || 'عذراً، لم أتمكن من صياغة إجابة واضحة.',
      confidence,
      intent: isCommercialClaim(intent) ? 'general' : intent,
      citedFactIds: cited,
      suggestedQuestionsAr: questions,
      blocked: Boolean(raw.blocked),
      disclaimerAr: needsCareDisclaimer(guarded.text, userMessage) ? this.moderation.disclaimer() : '',
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
      disclaimerAr: '',
    };
  }
}

function needsCareDisclaimer(answer: string, userMessage?: string): boolean {
  return /تشخيص|علاج طبي|دواء|روشتة|وصفة علاجية/.test(`${userMessage ?? ''} ${answer}`);
}
