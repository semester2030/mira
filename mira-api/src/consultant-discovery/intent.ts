/**
 * Deterministic Arabic intent signals for Consultant Discovery (study v1).
 * Digits, cities, and session corrections are first-class — no invented catalog facts.
 */

import { SAUDI_CITIES } from '../geo/saudi-cities';

export type WeddingRole = 'guest' | 'bride' | 'organizer' | 'unknown';
export type ImageKind = 'face' | 'outfit' | 'unknown' | 'none' | 'product';
export type PriceBound = 'inclusive' | 'exclusive' | null;

export type ConsultantIntentKind =
  | 'direct_product_search'
  | 'direct_service_search'
  | 'clarify'
  | 'advice_only'
  | 'refuse_path'
  | 'search_unavailable_note';

export interface SessionDiscoveryContext {
  q?: string | null;
  kindFilter?: 'product' | 'service' | null;
  lane?: string | null;
  lanes?: string[] | null;
  targetIds?: string[] | null;
  sourceId?: string | null;
  priceMaxSar?: number | null;
  priceBound?: PriceBound;
  city?: string | null;
  excludeColors?: string[] | null;
  excludeMetals?: string[] | null;
  requireFragranceFree?: boolean | null;
  ruleIds?: string[] | null;
  /** Last grounded offers from browse — order is ordinal («الأول/الثاني»), not fitness rank. */
  lastOffers?: Array<{
    id: string;
    kind: 'product' | 'service';
    titleAr: string;
    priceSar: number | null;
    partnerId?: string | null;
    inStock?: boolean | null;
    matchKind?: 'exact' | 'similar' | null;
    /**
     * Live catalog status — refreshed before compare / which-fits.
     * unverifiable = network/server error (do not assert old price/stock).
     */
    liveStatus?: 'published' | 'withdrawn' | 'unverifiable' | 'unknown' | null;
    bookingEnabled?: boolean | null;
    action?: 'buy' | 'book' | 'view' | null;
  }> | null;
  /**
   * Still collecting constraints for an in-progress service ask.
   * Stays true after city is known — cleared only on topic change / cancel / advice.
   */
  pendingServiceAsk?: boolean | null;
  /** @deprecated alias — prefer pendingServiceAsk */
  pendingHomeService?: boolean | null;
  /** Still need a city before search can finalize. */
  awaitingCity?: boolean | null;
  placeModes?: string[] | null;
  providerKindPrefer?: 'independent' | 'facility' | null;
  servicePlace?: 'home' | 'venue' | null;
  /** Soft occasion continuity across short chip replies (e.g. «أنا ضيفة»). */
  occasion?: 'wedding' | null;
  weddingRole?: WeddingRole | null;
  /** Guest journey step after role is known. */
  guestLookStep?: 'need_goal' | 'coord_dress' | 'makeup_hair' | null;
}

export interface ConsultantSignals {
  raw: string;
  normalized: string;
  weddingMentioned: boolean;
  weddingRole: WeddingRole;
  budgetMaxSar: number | null;
  /** inclusive = حتى/تحت/بحد؛ exclusive = أقل من */
  priceBound: PriceBound;
  city: string | null;
  dateMentioned: boolean;
  wantsBag: boolean;
  wantsClutchOrBag: boolean;
  wantsStylist: boolean;
  wantsDressOnly: boolean;
  wantsEveningDress: boolean;
  faceImageOnlyNoBooking: boolean;
  babyGift: boolean;
  newbornGift: boolean;
  refusedOrganizer: boolean;
  giftNotForSelf: boolean;
  laserExplicit: boolean;
  makeupService: boolean;
  makeupProductPurchase: boolean;
  moisturizerFragranceFree: boolean;
  excludeGoldTone: boolean;
  isCorrectionOnly: boolean;
  imageKind: ImageKind;
  favorsGraduation: boolean;
  hospitalityAmbiguous: boolean;
  ringForMother: boolean;
  goldKarat18: boolean;
  cancelledEvent: boolean;
  /** «أبي نفس هذا المنتج» / match this image — needs catalog identity, not care advice. */
  wantsSameProduct: boolean;
  wantsSimilarProduct: boolean;
  wantsHairstyleService: boolean;
  wantsCompareOffers: boolean;
  wantsWhichFitsMe: boolean;
  hasProductAttachment: boolean;
  attachmentHintAr: string | null;
  /** «أبي أعرف ليش…» / تفسير بشرة — استشارة لا بحث كتالوج. */
  wantsSkinExplain: boolean;
  /** «أبي نصيحة» بلا موضوع — توضيح قصير. */
  wantsBareAdvice: boolean;
  /** كوافيرة/تصفيف في موقع العميلة (منزل). */
  wantsHomeHairService: boolean;
  /** Product delivery to home — not a mobile service. */
  wantsProductHomeDelivery: boolean;
  /** Makeup/hair artist at event venue/hall. */
  wantsVenueArtistService: boolean;
  /** Follow-up: city-only reply while a service ask is pending. */
  isCityOnlyReply: boolean;
  /** Follow-up: prefer independent specialist. */
  wantsIndependentProvider: boolean;
  /** Follow-up: prefer salon/facility. */
  wantsFacilityProvider: boolean;
  /** Care advice about hair (not a product/service shop). */
  wantsHairAdvice: boolean;
  /** Skin concern topic when explaining (must match the customer's words). */
  skinConcern: 'dry' | 'oily' | 'sensitive' | 'general' | null;
  /** Venue service is makeup vs hair (do not collapse hair→makeup). */
  venueServiceKind: 'makeup' | 'hair' | null;
}

export interface ConsultantIntent {
  kind: ConsultantIntentKind;
  ruleIds: string[];
  sourceId: string | null;
  targetIds: string[];
  lane: string | null;
  /** When set, browse merges results across these lanes (e.g. children+gifts). */
  lanes: string[] | null;
  kindFilter: 'product' | 'service' | null;
  q: string | null;
  priceMax: number | null;
  priceBound: PriceBound;
  city: string | null;
  excludeColors: string[];
  excludeMetals: string[];
  requireFragranceFree: boolean;
  replyAr: string;
  askAr: string | null;
  /** Short tap answers / actions for the client chips — never Mira's own question. */
  choiceChipsAr: string[];
  sideSuggestionAr: string | null;
  sideTargetIds: string[];
  blockers: string[];
  saveAsPersonalPreference: false | boolean;
  sessionPatch: SessionDiscoveryContext | null;
}

const ARABIC_DIGITS: Record<string, string> = {
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
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
};

export function arabicDigitsToWestern(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (ch) => ARABIC_DIGITS[ch] ?? ch);
}

export function normalizeArabic(s: string): string {
  return arabicDigitsToWestern(s)
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْ]/g, '')
    .replace(/\u0640/g, '')
    .trim();
}

/** Match city against saudi-cities.json (handles جدة→جده, مكة المكرمة). */
export function matchSaudiCityAr(text: string): string | null {
  const n = normalizeArabic(text);
  // Prefer longer names first (مكة المكرمة before مكة).
  const sorted = [...SAUDI_CITIES].sort((a, b) => b.nameAr.length - a.nameAr.length);
  for (const c of sorted) {
    const nameN = normalizeArabic(c.nameAr);
    if (n.includes(nameN)) return c.nameAr;
    // short aliases
    if (nameN.startsWith('مكه') && /\bمكه\b|مكه\s/.test(n + ' ')) return c.nameAr;
    if (nameN.startsWith('جده') && /جده/.test(n)) return c.nameAr;
    if (nameN.startsWith('الرياض') && /الرياض/.test(n)) return c.nameAr;
  }
  // Explicit short forms after normalize
  if (/جده/.test(n)) return 'جدة';
  if (/مكه/.test(n)) return 'مكة المكرمة';
  if (/الرياض/.test(n)) return 'الرياض';
  return null;
}

export function parseBudget(n: string): { max: number; bound: PriceBound } | null {
  const exclusive = n.match(/(?:اقل من|أقل من)\s*(\d{2,6})/);
  if (exclusive) return { max: Number(exclusive[1]), bound: 'exclusive' };
  const inclusive = n.match(/(?:تحت|حتى|بسقف|بحد|اقل او يساوي|≤)\s*(\d{2,6})/)
    ?? n.match(/(\d{2,6})\s*(?:ريال|ر\.س|rs)/i);
  if (inclusive) return { max: Number(inclusive[1]), bound: 'inclusive' };
  return null;
}

export function extractSignals(
  message: string,
  opts?: {
    hasFaceImage?: boolean;
    imageKind?: ImageKind;
    session?: SessionDiscoveryContext | null;
    attachmentCount?: number;
    attachmentHintAr?: string | null;
  },
): ConsultantSignals {
  const raw = (message ?? '').trim();
  const n = normalizeArabic(raw);
  const attachmentCount = Math.max(0, opts?.attachmentCount ?? 0);
  const budget = parseBudget(n);
  let weddingRole: WeddingRole = 'unknown';
  if (/^(انا\s+)?(الضيفه|الضيفه|ضيفه|ضيف|مدعوه)\b/.test(n) || /انا ضيفه|أنا ضيفة|انا ضيفة/.test(n)) {
    weddingRole = 'guest';
  } else if (/^(انا\s+)?(العروس|عروس)\b/.test(n) || /انا العروس|أنا العروس/.test(n)) {
    weddingRole = 'bride';
  } else if (/ارتب الحفل|أرتّب الحفل|ارتب لشخص|لشخص اخر|لشخص آخر/.test(n)) {
    weddingRole = 'organizer';
  } else if (/ضيف|ضيفه|مدعوه/.test(n)) weddingRole = 'guest';
  else if (/عروس|فستان زفاف|فستان زواج/.test(n) && !/اختي|اختى/.test(n)) weddingRole = 'bride';
  else if (/ارتب|انظم|منسق|منسقه|اختي|حفل/.test(n) && /زواج|زفاف/.test(n)) {
    weddingRole = 'organizer';
  }
  if (weddingRole === 'unknown' && opts?.session?.weddingRole) {
    weddingRole = opts.session.weddingRole;
  }

  let imageKind: ImageKind =
    opts?.imageKind ??
    (opts?.hasFaceImage ? 'face' : 'none');
  // Treat explicit product imageKind as unknown for attachment product search.
  if (imageKind === 'product') imageKind = 'unknown';

  const makeupProductPurchase =
    /مكياج/.test(n) && /شراء|بشتري|اشتري|منتج|علبه|علبة|طقم/.test(n) && !/حجز|جلسه|صالون/.test(n);
  const makeupService =
    /مكياج/.test(n) &&
    !makeupProductPurchase &&
    (/حجز|جلسه|صالون|مناسبه/.test(n) || (/ابي|ابغى/.test(n) && !/شراء|منتج/.test(n)));

  const isCorrectionOnly =
    /^(بس\s+)?مو\s+/.test(n) ||
    /^(بدون|بلا)\s+/.test(n) ||
    (/مو ذهبي|مو دهبي|بدون عطر|بلا عطر/.test(n) && n.length < 40);

  const weddingMentioned =
    /زواج|زفاف/.test(n) || opts?.session?.occasion === 'wedding';

  return {
    raw,
    normalized: n,
    weddingMentioned,
    weddingRole,
    budgetMaxSar: budget?.max ?? null,
    priceBound: budget?.bound ?? null,
    city: matchSaudiCityAr(raw),
    dateMentioned: /تاريخ|يوم|الخميس|الجمعه|موعد/.test(n),
    wantsBag: /شنط|حقيبه|كلاتش/.test(n),
    wantsClutchOrBag: /شنط|حقيبه|كلاتش|لوك|اللوك|اكمل/.test(n),
    wantsStylist: /منسق|منسقه|تنسيق|منظمه/.test(n),
    wantsDressOnly:
      /الفستان بس|فستان بس|بس الفستان|فستان زفاف بس|فستان زواج بس|بدون اكسسوار/.test(n),
    wantsEveningDress: /فستان سهره|فساتين سهره/.test(n),
    faceImageOnlyNoBooking:
      imageKind === 'face' && !/حجز|عياده|ليزر|موعد/.test(n),
    babyGift: /مولود|مواليد|بيبي|طفل/.test(n) && /هدي|هديه|بشتري|اشتري|ابي|ابغى|بزور/.test(n),
    newbornGift: /مولود|مواليد/.test(n),
    refusedOrganizer: /لا ابي منظ|لا ابغى منظ|مو منظ|مو منسق|الفيت الحفل|الغيت الحفل|الحفل خلاص/.test(n),
    giftNotForSelf: /هديه مو لي|لوالدتي|لاختي|لمولود|لوالدتي/.test(n),
    laserExplicit: /ليزر/.test(n) && /ابي|ابغى|حجز/.test(n),
    makeupService,
    makeupProductPurchase,
    moisturizerFragranceFree: /مرطب/.test(n) && /(بدون عطر|بلا عطر|خالي من العطر)/.test(n),
    excludeGoldTone: /مو ذهبي|مو دهبي|بدون ذهبي|مش ذهبي/.test(n),
    isCorrectionOnly,
    imageKind,
    favorsGraduation: /توزيعات/.test(n) && /تخرج/.test(n),
    hospitalityAmbiguous: /ضيافه/.test(n) && !/شراء|حجز|مقدم/.test(n),
    ringForMother: /خاتم/.test(n) && /لوالدتي|امي|أمي/.test(n),
    goldKarat18: /ذهب/.test(n) && /عيار\s*18|18\s*k|karat\s*18/.test(n),
    cancelledEvent: /الفيت|الغيت|انتهت المناسبه|المناسبه مضت|موعد المناسبه مضى/.test(n),
    wantsSameProduct:
      /نفس هذا|مثل هذا|زي هذا|هالمنتج|هذا المنتج|نفس المنتج|ابي نفس|ابغى نفس/.test(n) &&
      !/بديل|مشابه|شبه/.test(n),
    wantsSimilarProduct: /بديل|مشابه|شبه هذا|زي كذا بس/.test(n),
    wantsHairstyleService:
      (/تسريح|قصه|قصّه|هايلايت|صبغه|لون شعر/.test(n) ||
        /مين تسوي|مين يسوي|صالون/.test(n)) &&
      (attachmentCount > 0 || /مثلها|زيها|نفس التسريح|مثل هالصوره|مثل الصورة/.test(n)),
    wantsCompareOffers: /قارن|قارني|فرّق|فرق بين|الاول بالثاني|الأول بالثاني/.test(n),
    wantsWhichFitsMe: /ايهم انسب|أيهم أنسب|انسب لي|أنسب لي|وش انسب|أي واحد لي/.test(n),
    hasProductAttachment:
      attachmentCount > 0 && imageKind !== 'face' && imageKind !== 'outfit',
    attachmentHintAr: (opts?.attachmentHintAr ?? '').trim() || null,
    wantsSkinExplain:
      /(اعرف|أعرف|افهم|أفهم|افسر|أفسّر|اشرح|تفسرين|توضحين).{0,20}(ليش|لماذا|سبب|علّة|عله)/.test(n) ||
      /(ليش|لماذا).{0,24}(بشرتي|بشره|جافه|جافة|دهنيه|دهنية|حساسه|تحسس)/.test(n) ||
      /(بشرتي|بشره).{0,16}(جافه|جافة|دهنيه|دهنية|حساسه).{0,20}(ليش|لماذا|سبب)/.test(n),
    skinConcern: /دهنيه|دهنية|زيتيه|زيتية/.test(n)
      ? 'oily'
      : /جافه|جافة|جفاف/.test(n)
        ? 'dry'
        : /حساسه|حساسة|تحسس/.test(n)
          ? 'sensitive'
          : /(بشرتي|بشره)/.test(n)
            ? 'general'
            : null,
    wantsBareAdvice:
      /^(ابي|ابغى|اريد|ودي)\s+(نصيحه|نصيحة|مساعده|مساعدة|استشاره|استشارة)\s*[.؟!]*$/.test(n) ||
      /^(نصيحه|نصيحة)\s*[.؟!]*$/.test(n),
    wantsProductHomeDelivery:
      /(شامبو|سيروم|مرطب|كريم|منتج|علبه|علبة)/.test(n) &&
      /(يوصل|توصيل|شحن|للبيت|للمنزل)/.test(n) &&
      !/(كوافيره|كوافيرة|مصففه|مصففة|ارتست|أرتست|فنان|خدمة)/.test(n),
    wantsVenueArtistService:
      /(ميك\s*اب|ميكاب|مكياج|makeup|ارتست|أرتست|artist|كوافيره|كوافيرة|مصففه|تصفيف|تسريح)/.test(n) &&
      /(تجي القاعه|تجي القاعة|للقاعه|للقاعة|في القاعه|في القاعة|قاعه|قاعة)/.test(n),
    venueServiceKind: /(ميك\s*اب|ميكاب|مكياج|makeup|ارتست|أرتست|artist)/.test(n)
      ? 'makeup'
      : /(كوافيره|كوافيرة|مصففه|تصفيف|تسريح)/.test(n) &&
          /(قاعه|قاعة)/.test(n)
        ? 'hair'
        : null,
    wantsHomeHairService:
      !/(شامبو|سيروم|مرطب|كريم|يوصل|توصيل|شحن|قاعه|قاعة)/.test(n) &&
      /(كوافيره|كوافيرة|مصففه|مصففة|تسريح|تصفيف)/.test(n) &&
      /(تجي البيت|تجيني|للبيت|بالبيت|منزلي|منزل|موقع العميله|عندي بالبيت|زيارة منزليه|خدمه منزليه)/.test(
        n,
      ),
    isCityOnlyReply:
      !!matchSaudiCityAr(raw) &&
      n.replace(/\s+/g, ' ').trim().length < 28 &&
      /^(في\s+)?[\u0600-\u06FFa-zA-Z]+$/.test(n.replace(/^(في)\s+/, 'في ').trim()),
    wantsIndependentProvider:
      /مختصه فرديه|مختصة فردية|ابيها فرديه|أبيها فردية|ابيها فردية|فرديه فقط|فردية فقط|مستقله|مستقلة/.test(
        n,
      ) || /^(فرديه|فردية)\s*[.؟!]*$/.test(n),
    wantsFacilityProvider:
      /صالون يعلن|صالون يقدم|منشأه|منشأة|صالون زيارات/.test(n) && !/فردي/.test(n),
    wantsHairAdvice:
      /^(ابي|ابغى|اريد|ودي)\s+(نصيحه|نصيحة)\s+(لشعري|عن شعري|شعري)/.test(n) ||
      /نصيحه لشعري|نصيحة لشعري|نصيحة عن شعري/.test(n),
  };
}

function isPendingServiceAsk(sess: SessionDiscoveryContext | null): boolean {
  if (!sess) return false;
  return !!(sess.pendingServiceAsk || sess.pendingHomeService);
}

export function decideIntent(
  signals: ConsultantSignals,
  session?: SessionDiscoveryContext | null,
): ConsultantIntent {
  const sess = session ?? null;

  if (signals.cancelledEvent || signals.refusedOrganizer) {
    return base({
      kind: 'refuse_path',
      ruleIds: ['gate.refuse'],
      replyAr: signals.cancelledEvent
        ? 'تم — أوقفت توصيات التجهيز المرتبطة بالمناسبة الملغاة أو المنتهية.'
        : 'تم — لن أقترح تنظيم الحفل في هذا السياق.',
      blockers: ['explicit_refuse'],
      sessionPatch: {},
    });
  }

  // Session correction: «بس مو ذهبي» keeps prior bag/budget search
  if (signals.isCorrectionOnly && sess?.q) {
    const excludeColors = [
      ...(sess.excludeColors ?? []),
      ...(signals.excludeGoldTone ? ['gold', 'ذهبي', 'دهبي'] : []),
    ];
    const requireFragranceFree = sess.requireFragranceFree || signals.moisturizerFragranceFree;
    return base({
      kind: sess.kindFilter === 'service' ? 'direct_service_search' : 'direct_product_search',
      ruleIds: sess.ruleIds?.length ? sess.ruleIds : ['gate.session_correction'],
      sourceId: sess.sourceId ?? null,
      targetIds: sess.targetIds ?? [],
      lane: sess.lane ?? null,
      lanes: sess.lanes ?? null,
      kindFilter: sess.kindFilter ?? 'product',
      q: sess.q,
      priceMax: signals.budgetMaxSar ?? sess.priceMaxSar ?? null,
      priceBound: signals.priceBound ?? sess.priceBound ?? null,
      city: signals.city ?? sess.city ?? null,
      excludeColors,
      excludeMetals: signals.excludeGoldTone ? ['gold'] : sess.excludeMetals ?? [],
      requireFragranceFree: !!requireFragranceFree,
      replyAr: 'حدّثت البحث بقيودك الجديدة مع الإبقاء على الطلب السابق.',
      blockers: ['session_correction'],
      sessionPatch: {
        q: sess.q,
        kindFilter: sess.kindFilter,
        lane: sess.lane,
        lanes: sess.lanes,
        targetIds: sess.targetIds,
        sourceId: sess.sourceId,
        priceMaxSar: signals.budgetMaxSar ?? sess.priceMaxSar,
        priceBound: signals.priceBound ?? sess.priceBound,
        city: signals.city ?? sess.city,
        excludeColors,
        requireFragranceFree: !!requireFragranceFree,
        ruleIds: sess.ruleIds,
      },
    });
  }

  // Explicit new service/place request wins over continuing the previous ask
  // («غيرت رأيي، أبي ميك أب أرتست تجي القاعة» must not keep كوافيرة منزل).
  const explicitNewServiceAsk =
    signals.wantsVenueArtistService ||
    signals.wantsHomeHairService ||
    signals.wantsProductHomeDelivery;

  // Resume only for short constraint replies (city / provider), not a new service ask.
  if (
    isPendingServiceAsk(sess) &&
    sess?.kindFilter === 'service' &&
    !explicitNewServiceAsk &&
    (signals.isCityOnlyReply ||
      signals.city ||
      signals.wantsIndependentProvider ||
      signals.wantsFacilityProvider) &&
    !signals.wantsSkinExplain &&
    !signals.wantsHairAdvice &&
    !signals.wantsBareAdvice
  ) {
    const city = signals.city ?? sess.city ?? null;
    const providerKindPrefer = signals.wantsIndependentProvider
      ? 'independent'
      : signals.wantsFacilityProvider
        ? 'facility'
        : sess.providerKindPrefer ?? null;
    const servicePlace = sess.servicePlace ?? 'home';
    const placeBlocker =
      servicePlace === 'venue'
        ? 'require_event_venue_capability'
        : 'require_home_visit_capability';
    const blockers = [
      servicePlace === 'venue' ? 'venue_artist_service' : 'home_hair_service',
      placeBlocker,
      'session_service_resume',
      ...(providerKindPrefer === 'independent' ? ['prefer_independent_provider'] : []),
      ...(providerKindPrefer === 'facility' ? ['prefer_facility_provider'] : []),
    ];
    const awaitingCity = !city;
    const askAr = awaitingCity
      ? 'في أي مدينة؟'
      : !providerKindPrefer
        ? 'تبين مختصة فردية أو صالون يقدم زيارات؟'
        : null;
    const placeLabel =
      servicePlace === 'venue' ? 'الحضور للقاعة' : 'موقع العميلة (منزل)';
    return base({
      kind: 'direct_service_search',
      ruleIds: sess.ruleIds?.length ? sess.ruleIds : ['hair.home_visit'],
      sourceId: sess.sourceId ?? 'hair.styling',
      targetIds: sess.targetIds ?? ['beauty.home_visit', 'hair.styling', 'beauty.salons'],
      lane: sess.lane ?? 'beauty',
      kindFilter: 'service',
      q: sess.q ?? (servicePlace === 'venue' ? 'مكياج قاعة' : 'كوافيرة منزل'),
      city,
      replyAr: awaitingCity
        ? `ما زلت على طلب ${sess.q ?? 'الخدمة'} لـ${placeLabel} — أضيفي المدينة لأبحث في العروض المنشورة.`
        : `أكمل البحث عن «${sess.q ?? 'الخدمة'}» لـ${placeLabel} ضمن ${city}` +
          (providerKindPrefer === 'independent'
            ? ' مع قيد المختصات الفرديات فقط (حساب بنوع مثبت).'
            : providerKindPrefer === 'facility'
              ? ' مع تفضيل الصالونات/المنشآت التي تعلن الزيارة.'
              : '.') +
          ' لن أغيّر نوع الخدمة أو مكانها.',
      askAr,
      blockers,
      sessionPatch: {
        ...sess,
        city,
        providerKindPrefer,
        awaitingCity,
        pendingServiceAsk: true,
        pendingHomeService: servicePlace === 'home',
        servicePlace,
        placeModes: servicePlace === 'home' ? ['home'] : null,
      },
    });
  }

  // «أبي» alone ≠ buy. Advice / skin explain before any catalog name search.
  if (signals.wantsHairAdvice) {
    return base({
      kind: 'advice_only',
      ruleIds: ['care.hair_advice'],
      replyAr: 'أساعدكِ بنصيحة لشعركِ كاستشارة — دون فتح بطاقات شراء أو حجز في هذه الخطوة.',
      askAr: 'ما الذي يقلقكِ في شعركِ أكثر شيء؟',
      blockers: ['hair_advice_not_catalog'],
      sessionPatch: {
        ...(sess ?? {}),
        lastOffers: sess?.lastOffers ?? null,
        pendingServiceAsk: false,
        pendingHomeService: false,
        awaitingCity: false,
      },
    });
  }

  if (signals.wantsBareAdvice) {
    return base({
      kind: 'clarify',
      ruleIds: ['gate.bare_advice'],
      replyAr: 'أكيد — عن أي شيء تريدين النصيحة الآن؟',
      askAr: 'بشرة، شعر، مناسبات، أو منتج معيّن؟',
      blockers: ['bare_advice_clarify'],
      sessionPatch: {
        ...(sess ?? {}),
        lastOffers: sess?.lastOffers ?? null,
        pendingServiceAsk: false,
        pendingHomeService: false,
        awaitingCity: false,
      },
    });
  }

  if (signals.wantsSkinExplain) {
    const concern = signals.skinConcern ?? 'general';
    const topicAr =
      concern === 'oily'
        ? 'دهنية البشرة'
        : concern === 'dry'
          ? 'جفاف البشرة'
          : concern === 'sensitive'
            ? 'حساسية البشرة'
            : 'حالة بشرتكِ';
    return base({
      kind: 'advice_only',
      ruleIds: ['care.skin_explain'],
      replyAr:
        `أجاوبكِ عن سبب ${topicAr} كاستشارة عناية` +
        (concern === 'oily'
          ? ' — زيادة الإفراز الدهني لها أسباب شائعة تختلف عن الجفاف'
          : concern === 'dry'
            ? ' — نقص الترطيب/الحاجز الجلدي يختلف عن الدهونية'
            : '') +
        '، وسأستند إلى تقرير بشرتكِ إن وُجد ومصرّح باستخدامه، دون البحث عن منتج بهذا النص ودون اختلاق نتيجة تحليل.',
      askAr: 'هل تريدين ربط الجواب بتقرير بشرتكِ إن وُجد؟',
      blockers: ['skin_explain_not_catalog', `skin_concern_${concern}`],
      sessionPatch: {
        ...(sess ?? {}),
        lastOffers: sess?.lastOffers ?? null,
        pendingServiceAsk: false,
        pendingHomeService: false,
        awaitingCity: false,
      },
    });
  }

  // Product delivery to the house ≠ mobile stylist.
  if (signals.wantsProductHomeDelivery) {
    const q =
      signals.normalized.match(/(شامبو|سيروم|مرطب|كريم)[^ ]*/)?.[0] ||
      signals.raw.match(/(شامبو|سيروم|مرطب|كريم)[^ ]*/u)?.[0] ||
      'منتج';
    return productSearch({
      ruleIds: ['care.product_home_delivery'],
      sourceId: 'unknown',
      targetIds: [],
      q,
      signals,
      replyAr: `أبحث عن منتج «${q}» للتوصيل من الكتالوج المنشور — هذا توصيل سلعة وليس زيارة كوافيرة.`,
      blockers: ['product_home_delivery_not_service'],
    });
  }

  if (signals.wantsVenueArtistService) {
    const city = signals.city ?? sess?.city ?? null;
    const kind = signals.venueServiceKind ?? 'makeup';
    const isHair = kind === 'hair';
    const q = isHair ? 'كوافيرة قاعة' : 'مكياج قاعة';
    const sourceId = isHair ? 'hair.styling' : 'beauty.makeup';
    const targetIds = isHair
      ? ['hair.styling', 'hair.color', 'beauty.salons']
      : ['beauty.makeup', 'service.salon_makeup'];
    return base({
      kind: 'direct_service_search',
      ruleIds: [isHair ? 'hair.venue_styling' : 'beauty.venue_artist'],
      sourceId,
      targetIds,
      lane: 'beauty',
      kindFilter: 'service',
      q,
      city,
      replyAr: city
        ? `أبحث عن ${isHair ? 'تصفيف/كوافيرة' : 'مكياج'} للقاعة ضمن ${city} — فقط العروض التي تُثبت حضور القاعة صراحة، ولن أعدّ home/either وحدهما دليلًا.`
        : `أبحث عن ${isHair ? 'تصفيف/كوافيرة' : 'مكياج'} للقاعة إن ثبتت إمكانية الحضور في بيانات العرض.`,
      askAr: city ? 'تبين مختصة فردية أو صالون يثبت الحضور للقاعة؟' : 'في أي مدينة القاعة؟',
      blockers: ['venue_artist_service', 'require_event_venue_capability'],
      sessionPatch: {
        q,
        kindFilter: 'service',
        lane: 'beauty',
        city,
        sourceId,
        targetIds,
        ruleIds: [isHair ? 'hair.venue_styling' : 'beauty.venue_artist'],
        pendingServiceAsk: true,
        pendingHomeService: false,
        awaitingCity: !city,
        servicePlace: 'venue',
        placeModes: null,
        lastOffers: sess?.lastOffers ?? null,
      },
    });
  }

  if (signals.wantsHomeHairService) {
    const city = signals.city ?? sess?.city ?? null;
    const providerKindPrefer = signals.wantsIndependentProvider
      ? 'independent'
      : signals.wantsFacilityProvider
        ? 'facility'
        : null;
    return base({
      kind: 'direct_service_search',
      ruleIds: ['hair.home_visit'],
      sourceId: 'hair.styling',
      targetIds: ['beauty.home_visit', 'hair.styling', 'beauty.salons'],
      lane: 'beauty',
      kindFilter: 'service',
      q: 'كوافيرة منزل',
      city,
      replyAr: city
        ? `أبحث عن خدمات شعر في موقع العميلة ضمن ${city} — فقط المختصة المتنقلة أو الصالون الذي يعلن الخيارين عبر placeMode، ولن أفترض أن كل صالون يزور المنزل.`
        : 'أبحث عن كوافيرة/تصفيف يدعم موقع العميلة (منزل). لن أفترض أن كل صالون يزور المنزل.',
      askAr: city ? 'تبين مختصة فردية أو صالون يقدم زيارات؟' : 'في أي مدينة؟',
      blockers: [
        'home_hair_service',
        'require_home_visit_capability',
        ...(providerKindPrefer === 'independent' ? ['prefer_independent_provider'] : []),
        ...(providerKindPrefer === 'facility' ? ['prefer_facility_provider'] : []),
      ],
      sessionPatch: {
        q: 'كوافيرة منزل',
        kindFilter: 'service',
        lane: 'beauty',
        city,
        sourceId: 'hair.styling',
        targetIds: ['beauty.home_visit', 'hair.styling', 'beauty.salons'],
        ruleIds: ['hair.home_visit'],
        pendingServiceAsk: true,
        pendingHomeService: true,
        awaitingCity: !city,
        providerKindPrefer,
        placeModes: ['home'],
        servicePlace: 'home',
        lastOffers: sess?.lastOffers ?? null,
      },
    });
  }

  // Compare / which-fits: ordinal order stays for «الثاني»; fitness is scored separately.
  if ((signals.wantsCompareOffers || signals.wantsWhichFitsMe) && sess?.lastOffers?.length) {
    const offers = sess.lastOffers;
    if (signals.wantsCompareOffers) {
      return buildCompareReply(offers, sess);
    }
    if (signals.wantsWhichFitsMe) {
      return buildWhichFitsReply(offers, sess, signals);
    }
  }

  if (signals.wantsHairstyleService) {
    const hint = signals.attachmentHintAr;
    return base({
      kind: 'direct_service_search',
      ruleIds: ['hair.style_from_image'],
      sourceId: 'hair.styling',
      targetIds: ['hair.styling', 'hair.color'],
      lane: 'elegance',
      kindFilter: 'service',
      q: hint || 'تسريحة',
      replyAr: hint
        ? `أبحث عن خدمة تسريح منشورة قريبة من وصف الصورة («${hint}»). زر «احجزي» يظهر فقط إن كانت الخدمة تدعم الحجز.`
        : 'وصلتني صورة الإطلالة/التسريحة. أبحث عن خدمات تسريح منشورة — وإن لم يكفِ الوصف أسألكِ عن طول الشعر أو نوع التسريحة.',
      askAr: hint ? null : 'ما طول شعرك أو نوع التسريحة المطلوبة؟',
      blockers: ['hairstyle_service_search'],
      sessionPatch: {
        q: hint || 'تسريحة',
        kindFilter: 'service',
        lane: 'elegance',
        sourceId: 'hair.styling',
        targetIds: ['hair.styling', 'hair.color'],
        ruleIds: ['hair.style_from_image'],
        lastOffers: sess?.lastOffers ?? null,
      },
    });
  }

  if (signals.hospitalityAmbiguous) {
    return base({
      kind: 'clarify',
      ruleIds: ['R069', 'gate.clarify_hospitality'],
      sourceId: 'occasions.decor',
      replyAr: 'هل تقصدين ضيافة جاهزة للشراء، أم مقدم خدمة للحجز؟',
      askAr: 'شراء جاهز أم حجز مقدم خدمة؟',
      blockers: ['ambiguous_hospitality'],
    });
  }

  if (signals.wantsDressOnly || /فستان زفاف|فستان زواج/.test(signals.normalized) ||
      (signals.weddingRole === 'bride' && /فستان/.test(signals.normalized))) {
    return productSearch({
      ruleIds: ['R001'],
      sourceId: 'clothes.wedding_dress',
      targetIds: ['clothes.wedding_dress'],
      q: 'فستان زواج',
      signals,
      replyAr: signals.wantsDressOnly
        ? 'أبحث لك عن فساتين زفاف ضمن طلبك بدون اقتراحات إضافية.'
        : 'أبحث لك عن فساتين زفاف مطابقة لطلبك.',
      blockers: signals.wantsDressOnly ? ['dress_only'] : [],
      sideSuggestionAr: null,
      sideTargetIds: [],
    });
  }

  if (signals.wantsEveningDress) {
    return productSearch({
      ruleIds: ['R005'],
      sourceId: 'clothes.evening',
      targetIds: ['clothes.evening'],
      q: 'فستان سهرة',
      signals,
      replyAr: 'أبحث عن فساتين سهرة مطابقة.',
      sideSuggestionAr: 'كلاتش',
      sideTargetIds: ['bags.clutch'],
    });
  }

  // Soft occasion opener («عندي مناسبة») before a specific wedding/event word.
  if (
    /عندي مناسب|عندي مناسبة|ابي مناسبه|أبي مناسبة|مناسبه واحتاج|مناسبة وأحتاج/.test(
      signals.normalized,
    ) &&
    !signals.weddingMentioned &&
    signals.weddingRole === 'unknown' &&
    !signals.wantsBag
  ) {
    return base({
      kind: 'clarify',
      ruleIds: ['gate.clarify_occasion'],
      replyAr: 'تمام، وش نوع المناسبة؟',
      askAr: null,
      choiceChipsAr: ['زفاف', 'خطوبة', 'سهرة', 'مناسبة أخرى'],
      blockers: ['ambiguous_occasion'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: null,
        weddingRole: null,
        guestLookStep: null,
      },
    });
  }

  if (signals.weddingMentioned && signals.weddingRole === 'unknown' && !signals.wantsBag && !signals.wantsStylist) {
    return base({
      kind: 'clarify',
      ruleIds: ['R002', 'gate.clarify_role'],
      sourceId: 'clothes.wedding_dress',
      replyAr: 'حلو، وش دورك في الزفاف؟',
      askAr: null,
      choiceChipsAr: ['أنا العروس', 'أنا ضيفة', 'أرتّب الحفل لشخص آخر'],
      blockers: ['ambiguous_wedding'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'unknown',
        guestLookStep: null,
      },
    });
  }

  const isGuest =
    signals.weddingRole === 'guest' || sess?.weddingRole === 'guest';
  const picksGuestDressShop = /اختار فستان|أختار فستان/.test(signals.normalized);
  const picksGuestCoordDress =
    /انسق فستان|أنسّق فستان|انسق فستاني|فستان عندي/.test(signals.normalized);
  const picksGuestMakeupHair =
    /ابي مكياج|أبي مكياج|مكياج وشعر|كوافير/.test(signals.normalized);
  const picksBagOrShoes =
    /شنط|حقيبه|حذاء|اقترحي شنط|أقترحي شنط/.test(signals.normalized);
  const picksDressColor = /اختار لونه|أختار لونه|لون الفستان|لونه/.test(
    signals.normalized,
  );

  if (isGuest && picksGuestDressShop) {
    return productSearch({
      ruleIds: ['R005', 'gate.guest_pick_dress'],
      sourceId: 'clothes.evening',
      targetIds: ['clothes.evening'],
      q: 'فستان سهرة',
      signals,
      replyAr: 'أبحث لكِ عن فساتين مناسبة كضيفة.',
      sideSuggestionAr: 'كلاتش',
      sideTargetIds: ['bags.clutch'],
      blockers: ['guest_dress_shop'],
      askAr: null,
    });
  }

  // Guest after role: pick look goal (dress / makeup / …).
  // Skip when they already named a product/service ask («أكمّل اللوك» → bags).
  if (
    isGuest &&
    signals.weddingMentioned &&
    !signals.wantsBag &&
    !signals.wantsClutchOrBag &&
    !signals.wantsDressOnly &&
    !signals.wantsEveningDress &&
    !signals.makeupService &&
    !signals.wantsHairstyleService &&
    !signals.wantsStylist &&
    !picksGuestCoordDress &&
    !picksGuestMakeupHair &&
    !picksBagOrShoes &&
    !picksDressColor &&
    sess?.guestLookStep !== 'coord_dress' &&
    sess?.guestLookStep !== 'makeup_hair'
  ) {
    return base({
      kind: 'clarify',
      ruleIds: ['R002', 'gate.guest_look_goal'],
      sourceId: 'clothes.evening',
      replyAr: 'وش ودّك نبدأ فيه لإطلالتك؟',
      askAr: null,
      choiceChipsAr: ['أختار فستان', 'أنسّق فستان عندي', 'أبي مكياج وشعر'],
      blockers: ['guest_need_goal'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'guest',
        guestLookStep: 'need_goal',
      },
    });
  }

  if (
    isGuest &&
    (picksGuestCoordDress ||
      (sess?.guestLookStep === 'coord_dress' &&
        !picksBagOrShoes &&
        !picksDressColor))
  ) {
    return base({
      kind: 'clarify',
      ruleIds: ['R002', 'gate.guest_dress_photo'],
      sourceId: 'clothes.evening',
      replyAr: 'أرسلي صورته، أو اختاري كيف نبدأ.',
      askAr: null,
      choiceChipsAr: ['أرسل صورة الفستان', 'أختار لونه', 'أقترحي شنطة وحذاء'],
      blockers: ['guest_coord_dress'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'guest',
        guestLookStep: 'coord_dress',
      },
    });
  }

  if (isGuest && picksDressColor) {
    return base({
      kind: 'clarify',
      ruleIds: ['R002', 'gate.guest_dress_color'],
      sourceId: 'clothes.evening',
      replyAr: 'وش لون فستانك تقريبًا؟',
      askAr: null,
      choiceChipsAr: ['أسود', 'بيج', 'أخضر زمردي', 'لون ثاني'],
      blockers: ['guest_dress_color'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'guest',
        guestLookStep: 'coord_dress',
      },
    });
  }

  if (isGuest && picksGuestMakeupHair && !sess?.servicePlace) {
    return base({
      kind: 'clarify',
      ruleIds: ['R002', 'gate.guest_makeup_place'],
      sourceId: 'beauty.makeup',
      replyAr: 'وين تبين الخدمة؟',
      askAr: null,
      choiceChipsAr: ['في الصالون', 'في البيت', 'في القاعة'],
      blockers: ['guest_makeup_place'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'guest',
        guestLookStep: 'makeup_hair',
        pendingServiceAsk: true,
        awaitingCity: true,
      },
    });
  }

  // Place chips after makeup/hair goal.
  if (
    isGuest &&
    sess?.guestLookStep === 'makeup_hair' &&
    /في الصالون|في البيت|في القاعه|في القاعة/.test(signals.normalized)
  ) {
    const place: 'home' | 'venue' | 'salon' = /قاع/.test(signals.normalized)
      ? 'venue'
      : /بيت|منزل/.test(signals.normalized)
        ? 'home'
        : 'salon';
    const city = signals.city ?? sess?.city ?? null;
    return base({
      kind: city ? 'direct_service_search' : 'clarify',
      ruleIds: ['R002', 'gate.guest_makeup_place_chosen'],
      sourceId: place === 'home' ? 'hair.home' : 'beauty.makeup',
      targetIds:
        place === 'home'
          ? ['hair.home', 'beauty.makeup']
          : ['beauty.makeup', 'hair.styling'],
      lane: 'elegance',
      kindFilter: 'service',
      q: place === 'venue' ? 'مكياج قاعة' : place === 'home' ? 'مكياج منزل' : 'مكياج صالون',
      city,
      replyAr: city
        ? `أبحث عن خدمة مكياج/شعر ${place === 'venue' ? 'للقاعة' : place === 'home' ? 'في البيت' : 'في الصالون'} في ${city}.`
        : `تمام — ${place === 'venue' ? 'في القاعة' : place === 'home' ? 'في البيت' : 'في الصالون'}. في أي مدينة؟`,
      askAr: null,
      choiceChipsAr: city ? [] : ['في الرياض', 'في جدة', 'في الدمام', 'مدينة أخرى'],
      blockers: city ? ['guest_makeup_search'] : ['guest_makeup_need_city'],
      sessionPatch: {
        ...(sess ?? {}),
        occasion: 'wedding',
        weddingRole: 'guest',
        guestLookStep: 'makeup_hair',
        pendingServiceAsk: true,
        awaitingCity: !city,
        servicePlace: place === 'salon' ? null : place,
        kindFilter: 'service',
        q: place === 'venue' ? 'مكياج قاعة' : place === 'home' ? 'مكياج منزل' : 'مكياج صالون',
        city,
      },
    });
  }

  if (signals.wantsBag || (signals.wantsClutchOrBag && (signals.weddingMentioned || signals.weddingRole === 'guest'))) {
    const excludeColors = signals.excludeGoldTone ? ['gold', 'ذهبي', 'دهبي'] : [];
    return productSearch({
      ruleIds: ['R016', 'R005'],
      sourceId: 'bags.hand',
      targetIds: ['bags.hand', 'bags.clutch'],
      q: 'شنطة',
      signals,
      excludeColors,
      replyAr: signals.budgetMaxSar
        ? `أبحث عن شنط ضمن ميزانية ${signals.priceBound === 'exclusive' ? 'أقل من' : 'حتى'} ${signals.budgetMaxSar} ريال.`
        : 'أبحث عن شنط تناسب إكمال اللوك.',
      blockers: ['no_organizer_for_guest'],
    });
  }

  if (signals.weddingRole === 'organizer' || (signals.wantsStylist && signals.weddingMentioned)) {
    const city = signals.city;
    return base({
      kind: city ? 'direct_service_search' : 'clarify',
      ruleIds: ['R002', 'R070'],
      sourceId: 'occasions.styling',
      targetIds: ['occasions.styling'],
      lane: 'occasions',
      kindFilter: 'service',
      q: 'تنسيق',
      city,
      replyAr: city
        ? `أبحث عن خدمة تنسيق مناسبة في ${city}. إن احتجت التاريخ للتحقق من الموعد سأسألك.`
        : 'للبحث عن منسّقة، ما هي المدينة؟',
      askAr: city ? (signals.dateMentioned ? null : 'ما تاريخ المناسبة إن رغبتِ بالتحقق من المواعيد؟') : 'ما هي المدينة؟',
      blockers: city ? [] : ['need_city'],
      sessionPatch: city
        ? { q: 'تنسيق', kindFilter: 'service', lane: 'occasions', targetIds: ['occasions.styling'], sourceId: 'occasions.styling', city, ruleIds: ['R070'] }
        : null,
    });
  }

  if (signals.favorsGraduation) {
    return productSearch({
      ruleIds: ['R068'],
      sourceId: 'occasions.favors',
      targetIds: ['occasions.favors'],
      lane: 'occasions',
      q: 'توزيعات',
      signals,
      replyAr: 'أبحث عن توزيعات تخرج للبيع — مع الكمية والمهلة إن ذُكرتا.',
    });
  }

  if (signals.faceImageOnlyNoBooking) {
    return base({
      kind: 'advice_only',
      ruleIds: ['gate.face_no_clinic'],
      replyAr: 'من صورة الوجه أقدر أقدّم ملاحظة تجميلية عامة. حجز عيادة أو ليزر يحتاج طلبًا صريحًا منكِ.',
      blockers: ['face_image_not_diagnosis'],
      saveAsPersonalPreference: false,
    });
  }

  if (signals.laserExplicit) {
    return base({
      kind: 'direct_service_search',
      ruleIds: ['R077'],
      sourceId: 'beauty.clinic_laser',
      targetIds: ['beauty.clinic_laser', 'service.clinic_laser'],
      lane: 'beauty',
      kindFilter: 'service',
      q: 'ليزر',
      city: signals.city,
      replyAr: 'أبحث عن جهات تقدّم خدمة ليزر مطابقة إن توفّرت — دون وعد بنتيجة علاجية.',
      sessionPatch: {
        q: 'ليزر',
        kindFilter: 'service',
        lane: 'beauty',
        targetIds: ['beauty.clinic_laser'],
        city: signals.city,
        ruleIds: ['R077'],
      },
    });
  }

  if (signals.makeupProductPurchase) {
    return productSearch({
      ruleIds: ['R031'],
      sourceId: 'face.makeup_face',
      targetIds: ['face.makeup_face', 'face.makeup_eyes', 'face.makeup_lips'],
      q: 'مكياج',
      signals,
      replyAr: 'أبحث عن منتجات مكياج للشراء ضمن كتالوج ميرا.',
    });
  }

  if (signals.makeupService) {
    return base({
      kind: 'direct_service_search',
      ruleIds: ['R074'],
      sourceId: 'beauty.makeup',
      targetIds: ['beauty.makeup', 'service.salon_makeup'],
      lane: 'beauty',
      kindFilter: 'service',
      q: 'مكياج',
      city: signals.city,
      replyAr: 'أبحث عن خدمات مكياج للحجز إن توفّرت.',
      sessionPatch: {
        q: 'مكياج',
        kindFilter: 'service',
        lane: 'beauty',
        targetIds: ['beauty.makeup'],
        city: signals.city,
        ruleIds: ['R074'],
      },
    });
  }

  if (signals.moisturizerFragranceFree) {
    return productSearch({
      ruleIds: ['R035'],
      sourceId: 'face.moisturizer',
      targetIds: ['face.moisturizer', 'body.moisturizer'],
      q: 'مرطب',
      signals,
      requireFragranceFree: true,
      replyAr: 'أبحث عن مرطب يثبت خلوه من العطر في وصفه — ولن أعتمد غياب الحقل كدليل.',
      blockers: ['require_fragrance_free_evidence'],
    });
  }

  // Image + «أبي نفس هذا» / بديل مشابه: search only with grounded name/hint; distinguish exact vs similar.
  if (signals.wantsSameProduct || signals.wantsSimilarProduct) {
    const named =
      signals.attachmentHintAr ||
      signals.normalized.match(/(?:اسمه|اسمها|ماركه|علامه|براند)\s+(.{2,40})/)?.[1]?.trim() ||
      null;
    if (named) {
      const similar = signals.wantsSimilarProduct && !signals.wantsSameProduct;
      return productSearch({
        ruleIds: [similar ? 'care.similar_product_named' : 'care.same_product_named'],
        sourceId: 'unknown',
        targetIds: [],
        q: named,
        signals,
        replyAr: similar
          ? `أبحث عن بدائل مشابهة منشورة قريبة من «${named}» — وسأسمّيها مشابهة لا نفس المنتج.`
          : `سأبحث عن نفس المنتج إن وُجد منشورًا باسم قريب من «${named}». إن لم يتطابق تمامًا أعرضه كـ«مشابه» فقط.`,
        blockers: [similar ? 'similar_product_named_search' : 'same_product_named_search'],
      });
    }
    return base({
      kind: 'clarify',
      ruleIds: ['care.same_product_need_identity'],
      replyAr: signals.hasProductAttachment
        ? 'وصلتني صورة المنتج. وجود تقرير بشرة سابق لا يجعلها صورة وجه — ما الاسم أو العلامة المكتوبة على العبوة؟'
        : 'لأعثر على نفس المنتج في كتالوج ميرا أحتاج اسمه أو العلامة، أو صورة أوضح يظهر عليها الاسم.',
      askAr: 'ما اسم المنتج أو العلامة؟',
      blockers: ['need_product_identity'],
      sessionPatch: sess,
    });
  }

  const wantsProduct =
    /رشح|رشّح|من ميرا|اشتري|ابي|ابغى|بشتري|منتج/.test(signals.normalized) ||
    signals.budgetMaxSar != null;
  const sunscreenMention =
    /واقي.?الشمس|واقي شمس|sunscreen|\bspf\b/.test(signals.normalized);
  const anaphorProduct =
    wantsProduct &&
    /(واحد|واحده|منه|هالواحد|هذا|هذي)/.test(signals.normalized) &&
    !sunscreenMention &&
    !/فستان|شنط|حقيبه|مكياج|مرطب|خاتم|ذهب|ليزر/.test(signals.normalized);

  // Explicit sunscreen product request (budget optional).
  if (sunscreenMention && wantsProduct) {
    return productSearch({
      ruleIds: ['R034', 'care.sunscreen'],
      sourceId: 'face.sunscreen',
      targetIds: ['face.sunscreen'],
      q: 'واقي شمس',
      signals,
      replyAr: 'أبحث عن واقي شمس منشور في كتالوج ميرا ضمن طلبك.',
    });
  }

  // «طيب رشّحي لي واحد…» after sunscreen advice — resolve via session care topic.
  if (
    anaphorProduct &&
    sess &&
    (sess.sourceId === 'face.sunscreen' ||
      (typeof sess.q === 'string' && /واقي|sunscreen|spf/i.test(sess.q)))
  ) {
    return productSearch({
      ruleIds: sess.ruleIds?.length ? sess.ruleIds : ['care.sunscreen.anaphora'],
      sourceId: 'face.sunscreen',
      targetIds: sess.targetIds?.length ? sess.targetIds : ['face.sunscreen'],
      q: sess.q ?? 'واقي شمس',
      signals,
      replyAr: 'فهمتُ أنكِ تقصدين واقي الشمس من حديثنا — أبحث عن عرض منشور يطابق ميزانيتكِ إن وُجد.',
      blockers: ['anaphora_sunscreen'],
    });
  }

  if (anaphorProduct && sess?.q) {
    return productSearch({
      ruleIds: sess.ruleIds?.length ? sess.ruleIds : ['gate.session_anaphora'],
      sourceId: sess.sourceId ?? 'unknown',
      targetIds: sess.targetIds ?? [],
      lane: sess.lane ?? undefined,
      lanes: sess.lanes ?? undefined,
      q: sess.q,
      signals,
      replyAr: 'تابعتُ طلبكِ السابق وأبحث عن عرض منشور مطابق.',
      blockers: ['session_anaphora'],
    });
  }

  if (signals.ringForMother || (/خاتم/.test(signals.normalized) && signals.giftNotForSelf)) {
    return productSearch({
      ruleIds: ['R059'],
      sourceId: 'jewelry.rings',
      targetIds: ['jewelry.rings'],
      lane: 'jewelry',
      q: 'خاتم',
      signals,
      replyAr: 'أبحث عن خاتم مناسب — وقد أسألك عن المقاس إن لزم. لن أفترض خطوبة.',
      askAr: 'هل تعرفين المقاس؟',
      blockers: ['gift_not_engagement'],
      saveAsPersonalPreference: false,
    });
  }

  if (signals.goldKarat18) {
    return productSearch({
      ruleIds: ['R059'],
      sourceId: 'jewelry.rings',
      targetIds: ['jewelry.rings', 'jewelry.necklaces', 'jewelry.bracelets', 'jewelry.earrings'],
      lane: 'jewelry',
      q: 'ذهب',
      signals,
      replyAr: 'أبحث عن قطع يثبت عيارها ١٨ — ولن أطابق كلمة «ذهبي» وحدها.',
      blockers: ['require_karat_evidence'],
    });
  }

  if (signals.babyGift || signals.newbornGift) {
    return productSearch({
      ruleIds: ['R065', 'R067'],
      sourceId: 'children.newborn',
      targetIds: ['children.newborn', 'gifts.boxes'],
      lanes: ['children', 'gifts'],
      q: 'مولود',
      signals,
      replyAr: 'أبحث عن هدية مناسبة لمولود في الأطفال والهدايا — ولن أحفظها كتفضيل شخصي لحسابك.',
      blockers: ['gift_not_account_preference'],
      saveAsPersonalPreference: false,
    });
  }

  // Direct named product ask: «أبي [اسم منتج منشور]» → catalog search (not advice_only).
  const namedQ = extractDirectNamedProductQuery(signals.raw, signals.normalized);
  if (namedQ) {
    return productSearch({
      ruleIds: ['care.direct_named_product'],
      sourceId: 'unknown',
      targetIds: [],
      q: namedQ,
      signals,
      replyAr: `أبحث في عروض ميرا المنشورة عن «${namedQ}».`,
      blockers: ['direct_named_product_search'],
    });
  }

  return base({
    kind: 'advice_only',
    ruleIds: ['gate.advice'],
    replyAr: 'أخبريني ماذا تبحثين عنه تحديدًا (منتج، خدمة، مدينة، أو ميزانية) لأفتح لكِ عروض ميرا المطابقة.',
    blockers: ['insufficient_signal'],
  });
}

/**
 * «أبي مرطب RC11 فريد …» / «أبي أشتري سيروم الندى» → catalog product query.
 * «أبي» alone is not a buy signal — advice, explain, and service asks return null.
 */
export function extractDirectNamedProductQuery(raw: string, normalized?: string): string | null {
  const text = (raw ?? '').trim();
  const n = normalized ?? normalizeArabic(text);
  if (!text) return null;
  // Explicit advice / how-to / skin explain — not a catalog purchase ask.
  if (
    /^(ما اهمية|ما أهمية|لماذا|كيف|وش رايك|شو رايك|هل يجب|متى استخدم)/.test(n) ||
    /لروتيني|روتيني الصباحي|نتائج التحليل|بشرتي فقط/.test(n) ||
    /(اعرف|أعرف|افهم|أفهم).{0,20}(ليش|لماذا)/.test(n) ||
    /(ليش|لماذا).{0,24}(بشرتي|بشره)/.test(n)
  ) {
    return null;
  }
  // Longer want/buy prefixes first so «أبي أشتري X» does not keep «أشتري» inside the name.
  const m =
    text.match(
      /^(?:أبي\s+أشتري|أبي\s+اشتري|أبغى\s+أشتري|ابغى\s+اشتري|ودي\s+أشتري|أريد\s+أشتري|ابي\s+شتري|أبي|ابغى|أبغى|أريد|ودي|رشّحي لي|رشحيني|رشّحيني)\s+(.+)$/u,
    ) ??
    n.match(
      /^(?:ابي\s+اشتري|ابغى\s+اشتري|ودي\s+اشتري|اريد\s+اشتري|ابي|ابغى|اريد|ودي|رشحي لي|رشحيني)\s+(.+)$/,
    );
  if (!m?.[1]) return null;
  let q = m[1].replace(/[.؟!]+$/u, '').trim();
  // Strip residual purchase verbs if a shorter prefix matched.
  q = q
    .replace(/^(?:أشتري|اشتري|بشتري|شراء|ابغى اشتري)\s+/u, '')
    .replace(/^(?:اشتري|بشتري|شراء)\s+/u, '')
    .trim();
  if (q.length < 3) return null;
  const qn = normalizeArabic(q);
  // Soft care / bare advice without a product title.
  if (/^(ترطيب لطيف|نصيحه|نصيحة|مساعده|مساعدة|استشاره|استشارة)$/.test(qn)) return null;
  // Skin-explain remainder («اعرف ليش بشرتي جافة») must never become a product title.
  if (
    /^(اعرف|افهم|افسر|اشرح)/.test(qn) ||
    /(ليش|لماذا).{0,24}(بشرتي|بشره|جافه|جافة)/.test(qn)
  ) {
    return null;
  }
  // Service roles / home hair — not product SKUs.
  if (
    /^(منسقه|منظمه|مصففه|حلاقه|مصممه|منسق|منظم|كوافيره|كوافيرة)(\s+في\s+\S+)?$/.test(qn) ||
    /^(منسقه|منظمه)\s+(حفل|زواج|عرس)/.test(qn) ||
    /(كوافيره|كوافيرة|مصففه|مصففة|تسريح|تصفيف)/.test(qn)
  ) {
    return null;
  }
  return q.slice(0, 120);
}

export type GroundedOfferRow = NonNullable<SessionDiscoveryContext['lastOffers']>[number];

const ORDINAL_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس'];

function offerLabelAr(o: GroundedOfferRow, index: number): string {
  const ord = ORDINAL_AR[index] ?? `رقم ${index + 1}`;
  return `${ord} «${o.titleAr}»`;
}

function formatOfferFactsAr(o: GroundedOfferRow): string {
  if (o.liveStatus === 'withdrawn') return 'مسحوب من الكتالوج · غير متاح للطلب';
  if (o.liveStatus === 'unverifiable') {
    return 'تعذّر التحقق من توفره الآن — لن أعتمد سعرًا أو توفرًا سابقًا';
  }
  const price = o.priceSar != null ? `${o.priceSar} ر.س` : 'سعر غير مذكور';
  const stock =
    o.inStock === false ? 'غير متوفر' : o.inStock === true ? 'متوفر' : 'التوفر غير مذكور';
  return `${price} · ${stock}`;
}

/** Whether price fits an explicit budget given inclusive/exclusive bound. */
export function priceFitsBudget(
  priceSar: number | null | undefined,
  budget: number | null | undefined,
  bound: PriceBound | undefined,
): 'fits' | 'over' | 'unknown_price' | 'no_budget' {
  if (budget == null || !Number.isFinite(budget)) return 'no_budget';
  if (priceSar == null || !Number.isFinite(priceSar)) return 'unknown_price';
  if (bound === 'exclusive') {
    return priceSar < budget ? 'fits' : 'over';
  }
  // inclusive (حتى/تحت/بحد) or unspecified with budget → ≤
  return priceSar <= budget ? 'fits' : 'over';
}

export function buildCompareReply(
  offers: GroundedOfferRow[],
  sess: SessionDiscoveryContext,
): ConsultantIntent {
  const lines = offers.map((o, i) => `• ${offerLabelAr(o, i)}: ${formatOfferFactsAr(o)}`);
  const anyWithdrawn = offers.some((o) => o.liveStatus === 'withdrawn');
  return base({
    kind: 'advice_only',
    ruleIds: ['dialogue.compare_grounded'],
    replyAr:
      `مقارنة بترتيب البطاقات (للإشارة بـ«الأول/الثاني»):\n` +
      `${lines.join('\n')}\n` +
      (anyWithdrawn
        ? 'العروض المسحوبة لم تعد منشورة — لن أعرض شراء أو حجزًا لها.\n'
        : '') +
      `لن أختلق مكوّنات أو نتائج غير مثبتة في الكتالوج.`,
    askAr: anyWithdrawn ? 'أبحثين عن بديل منشور؟' : 'أيهم أنسب لي؟',
    blockers: ['compare_grounded_only'],
    sessionPatch: sess,
  });
}

/**
 * Pick the best-fitting offer without reordering cards.
 * Excludes withdrawn / unverifiable / out-of-stock / over budget.
 * Unknown price never counts as «ضمن الميزانية».
 * Ties do not fall back to card order.
 */
export function pickBestFitOffer(
  offers: GroundedOfferRow[],
  sess: SessionDiscoveryContext | null,
): {
  pick: GroundedOfferRow | null;
  index: number;
  reasonAr: string;
  askAr: string | null;
  tied: boolean;
} {
  const budget = sess?.priceMaxSar ?? null;
  const bound = sess?.priceBound ?? null;
  const candidates: Array<{ o: GroundedOfferRow; index: number; score: number; reasons: string[] }> =
    [];

  for (let i = 0; i < offers.length; i++) {
    const o = offers[i];
    if (o.liveStatus === 'withdrawn') continue;
    if (o.liveStatus === 'unverifiable') continue;
    if (o.inStock === false) continue;
    const fit = priceFitsBudget(o.priceSar, budget, bound);
    if (fit === 'over') continue;
    // Explicit budget + unknown price → not eligible as «within budget».
    if (fit === 'unknown_price') continue;

    const reasons: string[] = [];
    let score = 0;
    if (o.inStock === true) {
      score += 40;
      reasons.push('متوفر');
    }
    if (fit === 'fits') {
      score += 50;
      const boundLabel = bound === 'exclusive' ? `أقل من ${budget}` : `حتى ${budget}`;
      reasons.push(`ضمن ميزانيتكِ (${boundLabel} ر.س)`);
    }
    if (fit === 'fits' && o.priceSar != null && budget != null) {
      score += Math.max(0, 20 - Math.min(20, o.priceSar / Math.max(budget, 1)));
    }
    if (sess?.requireFragranceFree) {
      reasons.push('مع قيد بدون عطر الذي صرّحتِ به');
      score += 5;
    }
    candidates.push({ o, index: i, score, reasons });
  }

  if (candidates.length === 0) {
    const unverifiable = offers.some((o) => o.liveStatus === 'unverifiable');
    return {
      pick: null,
      index: -1,
      reasonAr: unverifiable
        ? 'تعذّر التحقق من توفر بعض العروض الآن، ولا أجد خيارًا مثبتًا يناسب قيودكِ.'
        : 'لا أجد من العروض الظاهرة خيارًا يناسب قيودكِ المثبتة (التوفر أو الميزانية أو حالة النشر).',
      askAr: 'هل تريدين توسيع الميزانية أم البحث عن بديل منشور؟',
      tied: false,
    };
  }

  candidates.sort((a, b) => b.score - a.score);
  const top = candidates[0];
  const tied = candidates.length > 1 && candidates[1].score === top.score;
  if (tied) {
    const a = top.o;
    const b = candidates[1].o;
    const priceDiff =
      a.priceSar != null && b.priceSar != null && a.priceSar !== b.priceSar
        ? `الأسعار المثبتة: ${a.priceSar} ر.س مقابل ${b.priceSar} ر.س`
        : null;
    const stockDiff =
      a.inStock !== b.inStock
        ? `التوفر مختلف بين الخيارين`
        : null;
    const hint = [priceDiff, stockDiff].filter(Boolean).join(' · ');
    return {
      pick: null,
      index: -1,
      reasonAr: hint
        ? `الخياران متقاربان في التقييم. ${hint}. لن أختار بالترتيب الظاهر وحدَه.`
        : 'الخصائص المثبتة متقاربة بين الخيارين، ولا يكفي ترتيب الظهور لوحده للاختيار.',
      askAr: 'ما الأهم لكِ الآن: السعر الأقل أم التوفر الفوري؟',
      tied: true,
    };
  }

  return {
    pick: top.o,
    index: top.index,
    reasonAr: top.reasons.length
      ? top.reasons.join('، ')
      : 'الأنسب وفق الخصائص المثبتة المتاحة',
    askAr: null,
    tied: false,
  };
}

export function buildWhichFitsReply(
  offers: GroundedOfferRow[],
  sess: SessionDiscoveryContext,
  signals: ConsultantSignals,
): ConsultantIntent {
  void signals;
  const result = pickBestFitOffer(offers, sess);
  if (!result.pick) {
    return base({
      kind: 'advice_only',
      ruleIds: ['dialogue.which_fits_grounded'],
      replyAr: result.reasonAr,
      askAr: result.askAr,
      blockers: ['which_fits_grounded_only', 'which_fits_need_signal'],
      sessionPatch: sess,
    });
  }
  const ordinal = ORDINAL_AR[result.index] ?? `رقم ${result.index + 1}`;
  return base({
    kind: 'advice_only',
    ruleIds: ['dialogue.which_fits_grounded'],
    replyAr:
      `الأنسب لكِ من العروض الظاهرة هو ${ordinal} «${result.pick.titleAr}»` +
      ` لأن ${result.reasonAr}.` +
      ` ترتيب البطاقات لم يتغيّر — «الثاني» ما زال يشير لنفس المعرّف إن وُجد.`,
    askAr: 'عطيني رابط هذا العرض',
    blockers: ['which_fits_grounded_only'],
    sessionPatch: sess,
  });
}

function productSearch(opts: {
  ruleIds: string[];
  sourceId: string;
  targetIds: string[];
  q: string;
  signals: ConsultantSignals;
  replyAr: string;
  lane?: string | null;
  lanes?: string[] | null;
  blockers?: string[];
  sideSuggestionAr?: string | null;
  sideTargetIds?: string[];
  excludeColors?: string[];
  requireFragranceFree?: boolean;
  askAr?: string | null;
  saveAsPersonalPreference?: boolean;
}): ConsultantIntent {
  const lane = opts.lane ?? (opts.lanes?.[0] ?? 'elegance');
  return base({
    kind: 'direct_product_search',
    ruleIds: opts.ruleIds,
    sourceId: opts.sourceId,
    targetIds: opts.targetIds,
    lane,
    lanes: opts.lanes ?? null,
    kindFilter: 'product',
    q: opts.q,
    priceMax: opts.signals.budgetMaxSar,
    priceBound: opts.signals.priceBound,
    city: opts.signals.city,
    excludeColors: opts.excludeColors ?? [],
    requireFragranceFree: !!opts.requireFragranceFree,
    replyAr: opts.replyAr,
    askAr: opts.askAr ?? null,
    sideSuggestionAr: opts.sideSuggestionAr ?? null,
    sideTargetIds: opts.sideTargetIds ?? [],
    blockers: opts.blockers ?? [],
    saveAsPersonalPreference: opts.saveAsPersonalPreference ?? false,
    sessionPatch: {
      q: opts.q,
      kindFilter: 'product',
      lane,
      lanes: opts.lanes ?? null,
      targetIds: opts.targetIds,
      sourceId: opts.sourceId,
      priceMaxSar: opts.signals.budgetMaxSar,
      priceBound: opts.signals.priceBound,
      city: opts.signals.city,
      excludeColors: opts.excludeColors ?? [],
      requireFragranceFree: !!opts.requireFragranceFree,
      ruleIds: opts.ruleIds,
    },
  });
}

function base(
  partial: Partial<ConsultantIntent> & Pick<ConsultantIntent, 'kind' | 'ruleIds' | 'replyAr'>,
): ConsultantIntent {
  return {
    kind: partial.kind,
    ruleIds: partial.ruleIds,
    sourceId: partial.sourceId ?? null,
    targetIds: partial.targetIds ?? [],
    lane: partial.lane ?? null,
    lanes: partial.lanes ?? null,
    kindFilter: partial.kindFilter ?? null,
    q: partial.q ?? null,
    priceMax: partial.priceMax ?? null,
    priceBound: partial.priceBound ?? null,
    city: partial.city ?? null,
    excludeColors: partial.excludeColors ?? [],
    excludeMetals: partial.excludeMetals ?? [],
    requireFragranceFree: partial.requireFragranceFree ?? false,
    replyAr: partial.replyAr,
    askAr: partial.askAr ?? null,
    choiceChipsAr: partial.choiceChipsAr ?? [],
    sideSuggestionAr: partial.sideSuggestionAr ?? null,
    sideTargetIds: partial.sideTargetIds ?? [],
    blockers: partial.blockers ?? [],
    saveAsPersonalPreference: partial.saveAsPersonalPreference ?? false,
    sessionPatch: partial.sessionPatch ?? null,
  };
}
