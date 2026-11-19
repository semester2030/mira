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
  'ما أقدر أتحقق من منتجات أو خدمات ميرا الآن — بحث الكتالوج غير متاح في هذه البيئة، لذلك لن أنسب أي منتج أو خدمة أو سعر إلى كتالوج ميرا ولن أعرض رابطًا.';

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

/** Eastern + Western digits → Western; Arabic decimal ٫ → `.` for hallala checks. */
export function normalizeArabicDigits(text: string): string {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };
  return text
    .replace(/[٠-٩]/g, (d) => map[d] ?? d)
    .replace(/\u066B/g, '.') // ٫ Arabic decimal separator
    .replace(/\u066C/g, ''); // ٬ Arabic thousands separator
}

/**
 * True when answer invents / attributes a Mira catalog product OR service
 * without a published offer. Search-intent phrasing (I'll look for…) is allowed.
 */
export function claimsMiraCatalogProduct(answerAr: string): boolean {
  const raw = String(answerAr ?? '');
  if (!raw.trim()) return false;
  const text = normalizeArabicDigits(raw);

  // Honest search / unavailable language — not a catalog claim.
  if (
    /أقدر أبحث|أبحث لك|ما أقدر أتحقق|بحث الكتالوج غير متاح|لن أنسب|بدون نسبة منتج|إذا وُجد في الكتالوج|عند توفره في ميرا/.test(
      text,
    )
  ) {
    return false;
  }

  const attributesToMira = /من ميرا|منتجات ميرا|خدمات ميرا|كتالوج ميرا|متجر ميرا|في ميرا|لدى ميرا|عبر ميرا/.test(
    text,
  );
  if (!attributesToMira) return false;

  const looksLikeLatinSku =
    /[A-Za-z][A-Za-z0-9]+(?:\s+[A-Za-z][A-Za-z0-9]+){0,4}\s+(Moisturizer|Cream|Serum|Sunscreen|SPF|Cleanser|Toner|Mask|Session|Service)/i.test(
      text,
    ) || /مرطب\s+[«"']?[A-Za-z]/.test(text);

  const namedProduct =
    /(مرطب|كريم|سيروم|واقي(?:\s*شمس)?|منتج)\s+[\u0600-\u06FFA-Za-z0-9«»"'\-]{2,40}/.test(text);
  const namedService =
    /(جلسة|تسريحة|صبغة|مكياج|عناية|خدمة|حجز)\s+[\u0600-\u06FFA-Za-z0-9«»"'\-]{2,40}/.test(text);
  const priced =
    /(?:سعر|بـ|بـِ|بمبلغ)\s*\d+/.test(text) ||
    /\d+\s*(?:ريال|ر\.?\s*س)/.test(text);
  const ingredients = /حمض الهيالورونيك|مكوّن|مكونات/.test(text);

  // Named offer (product/service) or priced Mira attribution = inventing a record.
  return looksLikeLatinSku || namedProduct || namedService || (priced && (namedProduct || namedService || /ميرا/.test(text))) || ingredients;
}

/** Published catalog row the advisor may attribute to Mira (product or service). */
export type PublishedCatalogOffer = {
  id?: string;
  titleAr: string;
  kind?: string;
  priceSar?: number | null;
  inStock?: boolean | null;
};

/** Honest label when the catalog row has no registered price. */
export const PRICE_UNSPECIFIED_AR = 'غير مذكور';

export function publishedPriceLabelAr(offer: PublishedCatalogOffer): string {
  const n = offer.priceSar;
  if (n == null || !Number.isFinite(Number(n))) return PRICE_UNSPECIFIED_AR;
  const halalas = Math.round(Number(n) * 100);
  const riyals = Math.trunc(halalas / 100);
  const frac = Math.abs(halalas % 100);
  const body = frac === 0 ? `${riyals}` : `${riyals}.${frac.toString().padStart(2, '0')}`;
  return `${body} ريال`;
}

/** Fields the advisor may cite for one published offer — never invent beyond this row. */
export function recommendationFieldsFromOffer(offer: PublishedCatalogOffer): {
  id: string;
  kind: string;
  titleAr: string;
  priceLabelAr: string;
  inStock: boolean | null;
} {
  return {
    id: String(offer.id ?? '').trim(),
    kind: String(offer.kind ?? 'product'),
    titleAr: String(offer.titleAr ?? '').trim(),
    priceLabelAr: publishedPriceLabelAr(offer),
    inStock: offer.inStock ?? null,
  };
}

type OfferMention = {
  title: string;
  kind: 'product' | 'service';
  priceSar: number | null;
  claimsInStock: boolean | null;
};

/** Parse SAR including hallalas (49.99). Integer capture alone is not enough. */
export function parseCitedPriceSar(fragment: string): number | null {
  const m =
    fragment.match(/(?:بـ|بـِ|بسعر|بمبلغ)\s*(\d+(?:\.\d{1,2})?)/)?.[1] ??
    fragment.match(/(\d+(?:\.\d{1,2})?)\s*(?:ريال|ر\.?\s*س)/)?.[1] ??
    null;
  if (m == null) return null;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

/** Compare at halala precision — 49 ≠ 49.99. */
export function pricesMatchHalalas(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

function findPublishedByTitle(
  published: PublishedCatalogOffer[],
  title: string,
): PublishedCatalogOffer | undefined {
  const needle = title.trim();
  if (needle.length < 2) return undefined;
  return published.find((offer) => {
    const t = String(offer.titleAr ?? '').trim();
    if (t.length < 2) return false;
    return t === needle || t.includes(needle) || needle.includes(t);
  });
}

function stockClaimInFragment(around: string): boolean | null {
  if (/غير\s*متوفر|نفد(?:ت)?|غير\s*متاح/.test(around)) return false;
  if (/متوفر|متاح(?:\s*للطلب)?|موجود/.test(around)) return true;
  return null;
}

/**
 * Each product/service name attributed in the answer — one correct product never
 * authorizes a second undocumented service in the same reply.
 */
export function extractMiraOfferMentions(answerAr: string): OfferMention[] {
  const text = normalizeArabicDigits(String(answerAr ?? ''));
  const out: OfferMention[] = [];
  const seen = new Set<string>();

  const push = (kind: 'product' | 'service', rawTitle: string, around: string) => {
    const title = rawTitle.replace(/[«»"']/g, '').trim();
    if (title.length < 2) return;
    const key = `${kind}:${title}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      title,
      kind,
      priceSar: parseCitedPriceSar(around),
      claimsInStock: stockClaimInFragment(around),
    });
  };

  const productRe =
    /(مرطب|كريم|سيروم|واقي(?:\s*شمس)?|منتج)\s+([\u0600-\u06FFA-Za-z0-9«»"'\-]{2,40})/g;
  let m: RegExpExecArray | null;
  while ((m = productRe.exec(text)) != null) {
    const start = Math.max(0, m.index - 8);
    const end = Math.min(text.length, m.index + m[0].length + 36);
    push('product', `${m[1]} ${m[2]}`.trim(), text.slice(start, end));
  }

  const serviceRe =
    /(جلسة|تسريحة|صبغة|مكياج|عناية|خدمة)\s+([\u0600-\u06FFA-Za-z0-9«»"'\-]{2,40})/g;
  while ((m = serviceRe.exec(text)) != null) {
    const start = Math.max(0, m.index - 8);
    const end = Math.min(text.length, m.index + m[0].length + 36);
    push('service', m[0].trim(), text.slice(start, end));
  }

  return out;
}

function replaceUnregisteredPrices(text: string, published: PublishedCatalogOffer[]): string {
  let out = text;
  for (const offer of published) {
    const title = String(offer.titleAr ?? '').trim();
    if (title.length < 2 || offer.priceSar != null) continue;
    if (!out.includes(title)) continue;
    const idx = out.indexOf(title);
    const windowEnd = Math.min(out.length, idx + title.length + 48);
    const head = out.slice(0, idx + title.length);
    let tail = out.slice(idx + title.length, windowEnd);
    const rest = out.slice(windowEnd);
    tail = tail
      .replace(/(?:بـ|بـِ|بسعر|بمبلغ)\s*\d+(?:\.\d{1,2})?/g, `بـ ${PRICE_UNSPECIFIED_AR}`)
      .replace(/\d+(?:\.\d{1,2})?\s*(?:ريال|ر\.?\s*س)/g, PRICE_UNSPECIFIED_AR);
    out = head + tail + rest;
  }
  return out;
}

/**
 * True only when every named offer maps to a published row, cited price matches
 * at halala precision, and availability claims match inStock.
 */
export function answerGroundedInPublishedCatalog(
  answerAr: string,
  published: PublishedCatalogOffer[] = [],
): boolean {
  if (!claimsMiraCatalogProduct(answerAr)) return true;
  if (!published.length) return false;
  const text = normalizeArabicDigits(String(answerAr ?? ''));
  const mentions = extractMiraOfferMentions(text);
  if (!mentions.length) return false;

  for (const mention of mentions) {
    const offer = findPublishedByTitle(published, mention.title);
    if (!offer) return false;
    if (mention.priceSar != null) {
      if (offer.priceSar == null) return false;
      if (!pricesMatchHalalas(Number(offer.priceSar), mention.priceSar)) return false;
    }
    if (mention.claimsInStock != null && offer.inStock != null) {
      if (mention.claimsInStock !== offer.inStock) return false;
    }
  }
  return true;
}

/**
 * Bind each Mira attribution to a published catalog row returned by search.
 * Missing registered price → «غير مذكور». Wrong hallalas / stock → strip.
 * One grounded product never clears an invented second service.
 */
export function stripInventedMiraCatalogClaims(
  answerAr: string,
  published: PublishedCatalogOffer[] = [],
): string {
  if (!claimsMiraCatalogProduct(answerAr)) return answerAr;
  const text = normalizeArabicDigits(String(answerAr ?? ''));
  const mentions = extractMiraOfferMentions(text);
  if (!mentions.length) return MIRA_CATALOG_UNAVAILABLE_AR;

  for (const mention of mentions) {
    if (!findPublishedByTitle(published, mention.title)) {
      return MIRA_CATALOG_UNAVAILABLE_AR;
    }
  }

  const rewritten = replaceUnregisteredPrices(text, published);
  if (!answerGroundedInPublishedCatalog(rewritten, published)) {
    return MIRA_CATALOG_UNAVAILABLE_AR;
  }
  return rewritten;
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

/** Facts grounded on the open marketplace offer (provider description/price — never invented). */
export function marketplaceOfferFacts(input: {
  id: string;
  kind: 'product' | 'service';
  nameAr: string;
  descriptionAr?: string | null;
  priceHalalas?: number | null;
  /** Services: bookingEnabled. Products: only when stock is tracked (stockAvailable). */
  availability?: boolean | null;
  durationMin?: number | null;
  partnerNameAr?: string | null;
}): Array<{
  id: string;
  labelAr: string;
  valueAr: string;
  confidence: 'high' | 'medium' | 'low';
  commercial?: { subjectAr: string; priceAmount?: string; currency?: 'SAR'; availability?: boolean };
}> {
  type OfferFact = {
    id: string;
    labelAr: string;
    valueAr: string;
    confidence: 'high' | 'medium' | 'low';
    commercial?: { subjectAr: string; priceAmount?: string; currency?: 'SAR'; availability?: boolean };
  };
  const title = String(input.nameAr ?? '').trim() || 'العرض';
  const kindLabel = input.kind === 'service' ? 'اسم الجلسة' : 'اسم المنتج';
  const commercial: OfferFact['commercial'] = { subjectAr: title };
  if (input.availability === true || input.availability === false) {
    commercial.availability = input.availability;
  }
  if (typeof input.priceHalalas === 'number' && Number.isFinite(input.priceHalalas)) {
    commercial.priceAmount = (input.priceHalalas / 100).toFixed(input.priceHalalas % 100 === 0 ? 0 : 2);
    commercial.currency = 'SAR';
  }
  const facts: OfferFact[] = [
    {
      id: `marketplace.offer.title.${input.id}`,
      labelAr: kindLabel,
      valueAr: title,
      confidence: 'high',
      commercial,
    },
    {
      id: `marketplace.offer.kind.${input.id}`,
      labelAr: 'نوع العرض',
      valueAr: input.kind === 'service' ? 'جلسة' : 'منتج',
      confidence: 'high',
    },
  ];
  const desc = String(input.descriptionAr ?? '').trim();
  if (desc) {
    facts.push({
      id: `marketplace.offer.description.${input.id}`,
      labelAr: input.kind === 'service' ? 'وصف الجلسة من المقدّم' : 'وصف المنتج من المقدّم',
      valueAr: desc,
      confidence: 'high',
    });
  }
  if (input.kind === 'service' && typeof input.durationMin === 'number' && input.durationMin > 0) {
    facts.push({
      id: `marketplace.offer.duration.${input.id}`,
      labelAr: 'مدة الجلسة',
      valueAr: `${input.durationMin} دقيقة`,
      confidence: 'high',
    });
  }
  const partner = String(input.partnerNameAr ?? '').trim();
  if (partner) {
    facts.push({
      id: `marketplace.offer.partner.${input.id}`,
      labelAr: 'المقدّم',
      valueAr: partner,
      confidence: 'high',
    });
  }
  return facts;
}

function hasOpenMarketplaceOffer(
  facts: Array<{ id: string; labelAr?: string; valueAr?: string }>,
): boolean {
  return facts.some((f) => f.id.startsWith('marketplace.offer.'));
}

/** True when the question is about the open offer — not a general skin/routine ask. */
export function isOpenOfferIncludesQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  // General routine / skin questions must not steal the offer-includes path.
  if (/روتين|بشرتي|صباحي|مسائي/.test(text) && !/(الجلسة|هذه الجلسة|الخدمة|العرض|المنتج)/.test(text)) {
    return false;
  }
  return /تشمل|يشمل|يحتوي|تحتوي|وش في|وش فيه|ماذا تشمل|وش تشمل|ما تشمل|محتوى الجلسة|تفاصيل الجلسة|عن الجلسة|عن المنتج|محتوى المنتج|وش يحتوي/.test(
    text,
  );
}

function offerLiveStatusLine(
  facts: Array<{ id: string; valueAr?: string }>,
): 'withdrawn' | 'error' | null {
  const status = facts.find((f) => f.id.startsWith('marketplace.offer.status.'));
  if (!status?.valueAr) return null;
  if (status.valueAr.includes('سُحب') || status.valueAr.includes('أوقف من النشر')) return 'withdrawn';
  if (status.valueAr.includes('تعذّر التحقق')) return 'error';
  return null;
}

/**
 * Alternatives / compare asks — must be classified *before* open-offer price/book/includes.
 * Never answer these with the open offer's published price.
 */
export function isAlternativesOrCompareAsk(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  return /بدائل|غير هذه|خدمة ثانية|مركز آخر|صالون آخر|قارن(?:ي|وا)?|بمقارن|سعرها ب|بكم\s+خدمة\s+ثانية|كم\s+سعر\s+البدائل/.test(
    text,
  );
}

/** Price-of-alternatives or compare-price — local clarify before discovery and open-offer price. */
export function isAlternativesPriceOrCompareAsk(message: string): boolean {
  const text = message.trim();
  if (!text || !isAlternativesOrCompareAsk(text)) return false;
  return /بكم|سعر|قارن|ثمن|how much|price/i.test(text);
}

/** Price ask about the open marketplace offer (demonstrative «هذه/ها»), not alternatives. */
export function isOpenOfferPriceQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isAlternativesOrCompareAsk(text)) return false;
  return /كم\s*(?:ال)?سعر|بكم|ما\s*(?:ال)?سعر|سعرها|ثمنها|how much|price/i.test(text);
}

/** Booking intent about the open service offer (not a catalog search for alternatives). */
export function isOpenOfferBookingQuestion(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  // Search-for-alternatives stays with discovery — not the open-offer gate.
  if (isAlternativesOrCompareAsk(text)) return false;
  return /أقدر\s*أحجز|اقدر\s*احجز|أحجزها|احجزها|احجزيها|احجزي|أبي\s*أحجز|ابي\s*احجز|هل\s*أقدر\s*أحجز|أقدر أحجزها|هل\s*الحجز\s*متاح|الحجز\s*متاح|هل\s*فيه\s*موعد|فيه\s*موعد|أقدر\s*أحجزها|موعد\s*اليوم|احجزي\s*لي/.test(
    text,
  );
}

export type AlternativesPublishedOffer = {
  id: string;
  titleAr: string;
  kind?: string;
  priceSar?: number | null;
  inStock?: boolean | null;
};

/**
 * When discovery is off (or before/after search): clarify alternatives/compare without
 * attributing the open offer price to a second service. If published alternatives are
 * provided, list each with its own price — never the open-offer price.
 */
export function marketplaceAlternativesOrCompareReply(
  message: string,
  facts: Array<{
    id: string;
    labelAr?: string;
    valueAr?: string;
    commercial?: { subjectAr?: string; priceAmount?: string; currency?: string; availability?: boolean };
  }> = [],
  publishedAlternatives: AlternativesPublishedOffer[] = [],
): string | null {
  const text = message.trim();
  if (!text || !isAlternativesOrCompareAsk(text)) return null;

  const title = facts.find((f) => f.id.startsWith('marketplace.offer.title.'));
  const openName = title?.valueAr?.trim() || 'العرض المفتوح';
  const openPrice =
    title?.commercial?.priceAmount && title.commercial.currency === 'SAR'
      ? title.commercial.priceAmount
      : null;
  const live = offerLiveStatusLine(facts);

  if (/قارن(?:ي|وا)?|بمقارن|سعرها ب/.test(text)) {
    const named =
      text.match(/(?:ب|مع|و)?(?:خدمة\s+)?([\u0600-\u06FF]{3,40})\s*$/)?.[1]?.trim() ||
      text.match(/بخدمة\s+([\u0600-\u06FFA-Za-z0-9]{2,40})/)?.[1]?.trim() ||
      text.match(/قارن(?:ي|وا)?\s+(?:سعرها\s+)?(?:ب|مع)?\s*(?:خدمة\s+)?([\u0600-\u06FFA-Za-z0-9]{2,40})/)?.[1]?.trim();
    if (!named || /سعرها|بكم|هذه|العرض/.test(named)) {
      return `للمقارنة أحتاج مصدرين معروفين بأسعارهما المنشورة. حددي الخدمة الثانية بالاسم — ولن أنسب سعر «${openName}» لبديل غير محدد.`;
    }
    const match = publishedAlternatives.find((o) => o.titleAr.includes(named) || named.includes(o.titleAr));
    if (live === 'withdrawn' && !match) {
      return `العرض المفتوح لم يعد منشورًا، ولا أملك سعرًا منشورًا موثوقًا لـ«${named}» هنا — لن أخترع مقارنة ولن أعيد سعرًا قديمًا.`;
    }
    if (live === 'error' && !match) {
      return `تعذّر التحقق من العرض المنشور الآن، ولا أجد سعرًا منشورًا لـ«${named}» في هذه الجلسة — لن أخمن مقارنة.`;
    }
    if (match) {
      if (match.priceSar == null || !Number.isFinite(match.priceSar)) {
        return `وجدتُ «${match.titleAr}» منشورة لكن بلا سعر منشور — لن أخترع رقمًا ولن أنسب سعر «${openName}» لها.`;
      }
      if (openPrice && live !== 'withdrawn' && live !== 'error') {
        return `مقارنة منشورة: «${openName}» ${openPrice} ريال مقابل «${match.titleAr}» ${match.priceSar} ريال — كل سعر من مصدره، دون خلط.`;
      }
      return `سعر «${match.titleAr}» المنشور ${match.priceSar} ريال. لا أستخدم سعر العرض المفتوح بديلًا عنه.`;
    }
    if (!openPrice || live === 'withdrawn' || live === 'error') {
      return `لا أجد سعرًا منشورًا لـ«${named}» في هذه الجلسة — لن أخترع مقارنة ولن أعيد سعرًا قديمًا لـ«${openName}».`;
    }
    return `أعرف سعر «${openName}» المنشور (${openPrice} ريال) لكن لا أجد سعرًا منشورًا لـ«${named}» في هذه الجلسة — لن أنسب سعر «${openName}» لها ولن أخترع رقمًا.`;
  }

  // «بكم خدمة ثانية؟» / «كم سعر البدائل؟»
  const priced = publishedAlternatives.filter((o) => o.titleAr.trim());
  if (priced.length) {
    const lines = priced.map((o) => {
      if (o.priceSar == null || !Number.isFinite(o.priceSar)) {
        return `• «${o.titleAr}»: لا سعر منشور`;
      }
      return `• «${o.titleAr}»: ${o.priceSar} ريال`;
    });
    const prefix =
      live === 'withdrawn'
        ? `العرض المفتوح سُحب من النشر. بدائل منشورة بأسعارها الخاصة (ليس سعرًا قديمًا لـ«${openName}»):`
        : `بدائل منشورة بأسعارها الخاصة — ولن أستخدم سعر «${openName}»${openPrice ? ` (${openPrice} ريال)` : ''} لأي منها:`;
    return `${prefix}\n${lines.join('\n')}`;
  }

  if (live === 'withdrawn') {
    return `العرض المفتوح سُحب من النشر. أي بديل تقصدين؟ لن أعتمد سعرًا قديمًا لـ«${openName}» كسعر لخدمة ثانية، ولن أخترع أسعار بدائل غير منشورة.`;
  }
  if (live === 'error') {
    return `تعذّر التحقق من العرض المنشور الآن. حددي أي بديل تقصدين — ولن أنسب رقمًا غير متحقق لخدمة ثانية.`;
  }
  return `أي بديل أو خدمة ثانية تقصدين؟ لن أستخدم سعر «${openName}»${openPrice ? ` (${openPrice} ريال)` : ''} كسعر لبديل. إن وُجدت بدائل منشورة سأعرض كل واحدة بسعرها الخاص بعد تحديدها.`;
}

/**
 * Consultation-entry turn for alternatives/compare: answer + cards (no invented prices).
 * Used by schema/orchestrator so acceptance is on the final payload, not function text alone.
 */
export function buildAlternativesConsultationTurn(
  message: string,
  facts: Array<{
    id: string;
    labelAr?: string;
    valueAr?: string;
    commercial?: { subjectAr?: string; priceAmount?: string; currency?: string; availability?: boolean };
  }> = [],
  publishedAlternatives: AlternativesPublishedOffer[] = [],
  opts?: { discoveryEnabled?: boolean },
): {
  answerAr: string;
  replySource: 'discovery' | 'dialogue';
  discoveryOffers: Array<Record<string, unknown>>;
  discoveryEnabled: boolean;
} | null {
  const answerAr = marketplaceAlternativesOrCompareReply(message, facts, publishedAlternatives);
  if (!answerAr) return null;
  const discoveryEnabled = opts?.discoveryEnabled === true;
  const discoveryOffers: Array<Record<string, unknown>> = [];
  for (const o of publishedAlternatives) {
    const id = String(o.id ?? '').trim();
    const titleAr = String(o.titleAr ?? '').trim();
    if (!id || !titleAr) continue;
    const kind = o.kind === 'service' ? 'service' : 'product';
    const priceSar = o.priceSar != null && Number.isFinite(o.priceSar) ? o.priceSar : null;
    discoveryOffers.push({
      id,
      kind,
      titleAr,
      priceSar,
      priceLabelAr: priceSar != null ? `${priceSar} ر.س` : 'السعر غير مذكور في الكتالوج',
      inStock: o.inStock ?? null,
      action: kind === 'service' ? 'book' : 'buy',
      actionLabelAr: kind === 'service' ? 'احجزي' : 'اطلبي',
      openPath: `/${kind}/${id}`,
    });
  }
  return {
    answerAr,
    replySource: discoveryOffers.length ? 'discovery' : 'dialogue',
    discoveryOffers,
    discoveryEnabled,
  };
}

/** True when the message targets the open offer (includes / price / bookability). */
export function isOpenOfferLiveAsk(message: string): boolean {
  return (
    isOpenOfferIncludesQuestion(message) ||
    isOpenOfferPriceQuestion(message) ||
    isOpenOfferBookingQuestion(message)
  );
}

function withdrawnOrErrorReply(live: 'withdrawn' | 'error'): string {
  if (live === 'withdrawn') {
    return 'هذا العرض لم يعد منشورًا، لذلك لن أعتمد وصفًا أو سعرًا سابقًا ولن أقترح حجزه.';
  }
  return 'تعذّر التحقق من العرض المنشور الآن. أعيدي المحاولة بعد لحظات دون الاعتماد على وصف أو سعر قديم.';
}

/** Local reply when the customer asks what the *open* service/product includes. */
export function marketplaceOfferIncludesReply(
  message: string,
  facts: Array<{
    id: string;
    labelAr?: string;
    valueAr?: string;
    commercial?: { availability?: boolean };
  }> = [],
): string | null {
  const text = message.trim();
  if (!text) return null;
  if (!hasOpenMarketplaceOffer(facts)) return null;
  if (!isOpenOfferIncludesQuestion(text)) return null;
  const live = offerLiveStatusLine(facts);
  if (live) return withdrawnOrErrorReply(live);
  const desc = facts.find((f) => f.id.startsWith('marketplace.offer.description.'));
  const title = facts.find((f) => f.id.startsWith('marketplace.offer.title.'));
  const kind = facts.find((f) => f.id.startsWith('marketplace.offer.kind.'));
  const isProduct = kind?.valueAr === 'منتج';
  const noun = isProduct ? 'المنتج' : 'الجلسة';
  if (!desc?.valueAr?.trim()) {
    return `لا يوجد وصف منشور من المقدّم لـ${noun} حالياً، لذلك لن أخمن المحتوى.`;
  }
  const name = title?.valueAr?.trim() || noun;
  const bookingClosed =
    title?.commercial?.availability === false && !isProduct
      ? ' الحجز غير متاح لهذه الجلسة حاليًا.'
      : '';
  return `حسب وصف المقدّم لـ«${name}»: ${desc.valueAr.trim()}${bookingClosed}`;
}

/**
 * Price / bookability for the open offer from live facts only.
 * After withdraw or read error: no stale price, no booking CTA language.
 */
export function marketplaceOfferPriceOrBookReply(
  message: string,
  facts: Array<{
    id: string;
    labelAr?: string;
    valueAr?: string;
    commercial?: { subjectAr?: string; priceAmount?: string; currency?: string; availability?: boolean };
  }> = [],
): string | null {
  const text = message.trim();
  if (!text) return null;
  if (!hasOpenMarketplaceOffer(facts)) return null;
  const wantsPrice = isOpenOfferPriceQuestion(text);
  const wantsBook = isOpenOfferBookingQuestion(text);
  if (!wantsPrice && !wantsBook) return null;

  const live = offerLiveStatusLine(facts);
  if (live) return withdrawnOrErrorReply(live);

  const title = facts.find((f) => f.id.startsWith('marketplace.offer.title.'));
  const kind = facts.find((f) => f.id.startsWith('marketplace.offer.kind.'));
  const isProduct = kind?.valueAr === 'منتج';
  const name = title?.valueAr?.trim() || (isProduct ? 'المنتج' : 'الجلسة');
  const commercial = title?.commercial;

  if (wantsPrice) {
    if (!commercial?.priceAmount || commercial.currency !== 'SAR') {
      return `لا أجد سعرًا منشورًا حاليًا لـ«${name}»، لذلك لن أخمن رقمًا.`;
    }
    const stock =
      commercial.availability === true
        ? isProduct
          ? '، وهو متوفر للطلب.'
          : '، والحجز متاح للطلب (بانتظار رد المركز).'
        : commercial.availability === false
          ? isProduct
            ? '، وهو غير متوفر حاليًا.'
            : '، والحجز غير متاح لهذه الجلسة حاليًا.'
          : '.';
    return `سعر «${name}» ${commercial.priceAmount} ريال${stock}`;
  }

  // Booking ask
  if (isProduct) {
    return `«${name}» منتج للطلب وليس جلسة حجز.`;
  }
  if (commercial?.availability === false) {
    return `الحجز غير متاح لـ«${name}» حاليًا — العرض ما زال منشورًا لكن لا يمكن إرسال طلب موعد. لا أجزم بوجود موعد محدد.`;
  }
  if (commercial?.availability === true) {
    // BookingEnabled alone ≠ a concrete open slot — never invent a timed appointment.
    return `يمكنكِ إرسال طلب موعد لـ«${name}» من التطبيق؛ الطلب يبقى بانتظار رد المركز وليس تأكيدًا فوريًا، ولا أجزم بتوفر ساعة معيّنة من تفعيل الحجز وحده.`;
  }
  return `تعذّر الجزم بتوفر الحجز لـ«${name}» من البيانات المنشورة الآن.`;
}

/** Includes + price + book for the open offer (single entry used by orchestrator). */
export function marketplaceOfferLiveAskReply(
  message: string,
  facts: Array<{
    id: string;
    labelAr?: string;
    valueAr?: string;
    commercial?: { subjectAr?: string; priceAmount?: string; currency?: string; availability?: boolean };
  }> = [],
): string | null {
  return (
    marketplaceOfferIncludesReply(message, facts) ??
    marketplaceOfferPriceOrBookReply(message, facts)
  );
}

/** Offline advisor when LLM_API_KEY is missing — facts only, no invented scores. */
export function buildDegradedAdvisorReply(
  message: string,
  facts: Array<{ id: string; labelAr?: string; valueAr?: string }> = [],
): string {
  const text = message.trim();
  const offerAsk = marketplaceOfferLiveAskReply(text, facts);
  if (offerAsk) return offerAsk;
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
