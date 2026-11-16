import { MceAssistantPayloadV1 } from '../contracts/mce-context-snapshot.v1';

/** Map English severity tokens from the report contract to Arabic display labels. */
export function severityLabelAr(severity: string | null | undefined): string {
  const key = String(severity ?? '')
    .trim()
    .toLowerCase();
  switch (key) {
    case 'mild':
      return 'خفيف';
    case 'moderate':
      return 'متوسط';
    case 'priority':
    case 'severe':
    case 'noticeable':
      return 'أولوية عناية';
    case 'none':
      return 'ضمن النطاق الإيجابي';
    case 'unavailable':
    case '':
      return 'غير متاح';
    default:
      return String(severity).trim();
  }
}

export const SCOPE_REDIRECT_AR =
  'هذا خارج اختصاص ميرا. أقدر أساعدك في الجمال والعناية والبشرة والشعر والمكياج والعطور والملابس والألوان والإكسسوارات والمناسبات والمنتجات. إذا أعجبتك ألوان صورة، اطلبي استلهام إطلالة منها.';

export interface ScopeDecision {
  allow: boolean;
  replyAr: string;
}

const allowDecision = { allow: true, replyAr: '' };

/** What the user is asking Mira to produce, not a flat noun list. */
export function requestedOutcome(message: string): 'beauty' | 'other' | 'unclear' {
  const text = message.trim();
  if (!text) return 'unclear';
  const wantsColorCode = /كود اللون|كود لون|درجة اللون|hex|rgb/i.test(text) && /لون|فستان|قطعة|حذاء|حقيبة/.test(text);
  const wantsCode = !wantsColorCode && /برمج|اكتب كود|دالة|سكريبت|برنامج يحسب|احسبي بالكود/.test(text);
  const wantsVehicleWork = /زيت السيارة|غيار الزيت|تغيير زيت|محرك السيارة|فرامل/.test(text);
  const wantsBeautyResult =
    /إطلال|اطلال|مكياج|بشرة|عناية|شعر|عطر|حذاء|حقيبة|إكسسوار|اكسسوار|تنسيق|فستان|لون|ألوان/.test(text);
  const wantsInspiration = /استوح|استلهم|إلهام|الهام/.test(text);
  const wantsDescription = /صف |وصف |اشرح|ما هذا|ما هذه|عرّفي|عرفي/.test(text);
  const animalSubject = /قطة|شاهين|صقر|صقور|طائر/.test(text);
  if (wantsCode || wantsVehicleWork) return 'other';
  if (wantsInspiration && (wantsBeautyResult || /لون|ألوان/.test(text))) return 'beauty';
  if (animalSubject && wantsDescription && !wantsBeautyResult) return 'other';
  if (wantsBeautyResult) return 'beauty';
  if (animalSubject && !wantsInspiration) return 'other';
  return 'unclear';
}

export function decideConsultationScope(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
): ScopeDecision {
  const text = message.trim();
  if (!text) return allowDecision;
  const lastAssistant = [...history].reverse().find((item) => item.role === 'assistant');
  const previousRedirect = Boolean(lastAssistant?.content.includes('خارج اختصاص ميرا'));
  const followUp = /وضح|وضحي|أكثر|كملي|كمل|ليش|لماذا/.test(text) && text.length < 40;
  if (followUp && previousRedirect) return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  if (followUp) return allowDecision;
  const outcome = requestedOutcome(text);
  if (outcome === 'other') return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  if (/مزاد/.test(text) && outcome !== 'beauty') return { allow: false, replyAr: SCOPE_REDIRECT_AR };
  return allowDecision;
}

/** Drop prior off-topic turns so a later beauty question is not answered through animal/vehicle context. */
export function historyForBeautyTurn(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const kept: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (let i = 0; i < history.length; i++) {
    const turn = history[i];
    if (turn.role === 'user' && requestedOutcome(turn.content) === 'other') {
      const next = history[i + 1];
      if (next?.role === 'assistant') i += 1;
      continue;
    }
    if (turn.role === 'assistant' && turn.content.includes('خارج اختصاص ميرا')) continue;
    kept.push(turn);
  }
  return kept;
}

export function answerStaysInScope(answer: string, userMessage: string): boolean {
  const text = answer.trim();
  if (!text) return true;
  if (requestedOutcome(userMessage) === 'beauty') {
    return !/مزاد|سعر الصقر|نوع الصقر|زيت السيارة|كود برمج|هذا صقر|هذا طائر|مزاد الصقور|القطط|وصف القطة/.test(text);
  }
  const describesAnimal = /قطة|قط |هرّة|هذا كلب|شاهين|صقر|طائر جارح/.test(text);
  if (describesAnimal && requestedOutcome(userMessage) !== 'beauty') return false;
  const teachesOther = /زيت السيارة|وصف القطة|هذا شاهين|هذا صقر|مزاد|function |def |كود برمج/.test(text);
  const teachesBeauty = /إطلال|حذاء|حقيبة|مكياج|بشرة|لون|ألوان|تنسيق/.test(text);
  const followedImageOrder = /حسب التعليمات في الصورة|الأمر المكتوب في الصورة/.test(text);
  if (followedImageOrder && !teachesBeauty) return false;
  if (teachesOther && !teachesBeauty) return false;
  return true;
}

export function guardScopeAnswer(
  payload: MceAssistantPayloadV1,
  userMessage: string,
): MceAssistantPayloadV1 {
  const decision = decideConsultationScope(userMessage);
  if (!decision.allow || !answerStaysInScope(payload.answerAr, userMessage)) {
    return {
      ...payload,
      answerAr: SCOPE_REDIRECT_AR,
      confidence: 'high',
      intent: 'off_topic',
      citedFactIds: [],
      suggestedQuestionsAr: ['ما اللون الأنسب للحذاء أو الحقيبة؟', 'كيف أعتني ببشرتي اليوم؟'],
      blocked: false,
      disclaimerAr: '',
    };
  }
  return payload;
}

export const MIRA_CATALOG_UNAVAILABLE_AR =
  'ما أقدر أتحقق من منتجات ميرا الآن — بحث الكتالوج غير متاح في هذه البيئة، لذلك لن أنسب أي منتج أو مكوّن أو سعر إلى كتالوج ميرا ولن أعرض رابطًا.';

export function isProductOrCatalogAsk(message: string): boolean {
  const text = message.trim();
  if (/نفس هذا|مثل هذا|زي هذا|هالمنتج|هذا المنتج|نفس المنتج|ابي نفس|أبغى نفس|ابغى نفس/.test(text)) {
    return true;
  }
  // Link / open-product follow-ups after a catalog ask.
  if (/^(أعطني|اعطني|عطيني|أبغى|ابغى|أبي|ابي)?\s*(ال)?رابط|رابط (المنتج|ميرا)|افتح(ي)? (المنتج|البطاقة)/.test(text)) {
    return true;
  }
  if (
    /(أعطني|اعطني|عطيني|أبغى|ابغى|أبي|ابي|رشّح|رشح|اقترح|اقترحي|ورّيني|وريني)/.test(text) &&
    /(مرطب|واقي|منتج|كريم|سيروم|من ميرا)/.test(text)
  ) {
    return true;
  }
  if (/من ميرا/.test(text) && /(مرطب|واقي|منتج|كريم|سيروم|رابط)/.test(text)) {
    return true;
  }
  if (/رشّح|رشح|من ميرا/.test(text) && /أقل من|بأقل من|باقل من|\d|منتج|واقي|مرطب/.test(text)) {
    return true;
  }
  return /اشتري|بشتري|سعر/.test(text) && /منتج|كريم|واقي|مرطب|من ميرا/.test(text);
}

/** True when answer invents / attributes a Mira catalog SKU without a published offer. */
export function claimsMiraCatalogProduct(answerAr: string): boolean {
  const text = String(answerAr ?? '');
  if (!text.trim()) return false;
  const attributesToMira = /من ميرا|منتجات ميرا|كتالوج ميرا|متجر ميرا|في ميرا|لدى ميرا|عبر ميرا/.test(
    text,
  );
  if (!attributesToMira) return false;
  const looksLikeLatinSku =
    /[A-Za-z][A-Za-z0-9]+(?:\s+[A-Za-z][A-Za-z0-9]+){0,4}\s+(Moisturizer|Cream|Serum|Sunscreen|SPF|Cleanser|Toner|Mask)/i.test(
      text,
    ) || /مرطب\s+[«"']?[A-Za-z]/.test(text);
  // Arabic invented product + price/ingredient claims (e.g. «مرطب الندى بـ ٤٩ ريال من ميرا»).
  const looksLikeArabicOffer =
    /(مرطب|كريم|سيروم|واقي(?:\s*شمس)?|منتج)\s+[\u0600-\u06FFA-Za-z0-9«»"'\-]{2,40}/.test(text) ||
    /(?:سعر|بـ|بـِ|بمبلغ|ريال|ر\.?\s*س)\s*\d+/.test(text) ||
    /\d+\s*(?:ريال|ر\.?\s*س)/.test(text) ||
    /حمض الهيالورونيك|مكوّن|مكونات/.test(text);
  return looksLikeLatinSku || looksLikeArabicOffer;
}

export function stripInventedMiraCatalogClaims(answerAr: string): string {
  if (!claimsMiraCatalogProduct(answerAr)) return answerAr;
  return MIRA_CATALOG_UNAVAILABLE_AR;
}

/** Prefer numeric score facts; never surface raw English severity tokens. */
export function resolveMoistureDisplay(
  facts: Array<{ id: string; labelAr?: string; valueAr?: string }> = [],
): { labelAr: string; valueAr: string } | null {
  const score = facts.find((f) => /skin\.score\.(moisture|hydration)/i.test(f.id));
  if (score?.valueAr?.trim()) {
    return {
      labelAr: score.labelAr?.trim() || 'الترطيب',
      valueAr: score.valueAr.trim(),
    };
  }
  const concern = facts.find((f) => /moisture|hydration|ترطيب/i.test(`${f.id} ${f.labelAr ?? ''}`));
  if (!concern?.valueAr?.trim()) return null;
  return {
    labelAr: concern.labelAr?.trim() || 'الترطيب',
    valueAr: severityLabelAr(concern.valueAr.trim()),
  };
}

/** Offline advisor when LLM_API_KEY is missing — facts only, no invented scores. */
export function buildDegradedAdvisorReply(
  message: string,
  facts: Array<{ id: string; labelAr?: string; valueAr?: string }> = [],
): string {
  const text = message.trim();
  const asksMoisture = /ترطيب/.test(text);
  const asksSunscreen = /واقي.?الشمس|sunscreen|spf/i.test(text);
  const asksProduct = isProductOrCatalogAsk(text);
  const asksSameProduct =
    /نفس هذا|مثل هذا|زي هذا|هالمنتج|هذا المنتج|نفس المنتج|ابي نفس|أبغى نفس|ابغى نفس/.test(text);

  // Product / image-match asks must never fall through to hydration prose.
  if (asksProduct || asksSameProduct) {
    return [
      asksSameProduct
        ? 'طلبتِ مطابقة المنتج من الصورة أو «نفس هذا المنتج».'
        : 'فهمتُ طلب ترشيح/بحث منتج من ميرا.',
      MIRA_CATALOG_UNAVAILABLE_AR,
      'إذا رغبتِ بإرشاد عناية (ترطيب أو واقي شمس من تقريركِ) اسألي ذلك صراحةً — بدون نسبة منتج إلى ميرا.',
    ].join('\n');
  }

  if (asksMoisture) {
    const moisture = resolveMoistureDisplay(facts);
    if (moisture) {
      return [
        `حسب تقرير بشرتكِ، مؤشر ${moisture.labelAr} المسجّل هو ${moisture.valueAr}.`,
        'هذه قراءة تجميلية من التحليل وليست تشخيصاً طبياً. إذا لاحظتِ جفافاً أو شدّاً، ركّزي على مرطّب لطيف صباحاً ومساءً، وواقي شمس في النهار.',
        'إذا رغبتِ بتفاصيل أدق عن خطوة معيّنة في روتينكِ، اسألي مباشرة.',
      ].join('\n');
    }
    return [
      'لا أجد درجة ترطيب واضحة في سياق هذه الجلسة حالياً، لذلك لن أخمن رقماً.',
      'عمومًا: روتين لطيف = تنظيف خفيف، ترطيب منتظم، وواقي شمس نهاراً.',
      'أعيدي فتح المستشار من تقرير البشرة إن أردتِ الربط بالدرجات المسجّلة.',
    ].join('\n');
  }

  if (asksSunscreen) {
    return [
      'واقي الشمس خطوة أساسية في الروتين اليومي حتى في الأيام الغائمة: يحمي من التجفّف والتصبّغات المبكرة ويحافظ على نتائج العناية.',
      'اختاري قواماً يناسب بشرتكِ (خفيف للبشرة المختلطة/الدهنية، أغنى للجافة)، وضعيه صباحاً كآخر خطوة قبل المكياج أو الخروج.',
      'هذه إرشاد عناية عام — ليست وصفة طبية. إذا رغبتِ بترشيح منتج من ميرا فاذكري الميزانية والمدينة.',
    ].join('\n');
  }

  return [
    'محرك الاستشارة الذكي غير متصل الآن، لذلك أردّ بإرشاد عناية عام فقط.',
    'يمكنكِ سؤالي عن الترطيب أو واقي الشمس أو روتينكِ من التقرير، أو إعادة المحاولة بعد لحظات.',
  ].join('\n');
}
