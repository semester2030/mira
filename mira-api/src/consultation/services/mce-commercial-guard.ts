import { MceFactEntry } from '../contracts/mce-context-snapshot.v1';

export const COMMERCIAL_GAP_AR =
  'لا تتوفر لدي معلومة مؤكدة عن السعر أو التوفر. يمكنكِ مراجعة التفاصيل الظاهرة في «اكتشفي».';

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

const ONES: Record<string, number> = {
  صفر: 0,
  واحد: 1,
  واحده: 1,
  اثنان: 2,
  اثنين: 2,
  ثلاثه: 3,
  ثلاث: 3,
  اربعه: 4,
  اربع: 4,
  خمسه: 5,
  خمس: 5,
  سته: 6,
  ست: 6,
  سبعه: 7,
  سبع: 7,
  ثمانيه: 8,
  ثمان: 8,
  تسعه: 9,
  تسع: 9,
};

const HUNDREDS: Record<string, number> = {
  مئه: 100,
  مائه: 100,
  ميه: 100,
};

const TENS: Record<string, number> = {
  عشره: 10,
  عشر: 10,
  عشرون: 20,
  عشرين: 20,
  ثلاثون: 30,
  ثلاثين: 30,
  اربعون: 40,
  اربعين: 40,
  خمسون: 50,
  خمسين: 50,
  ستون: 60,
  ستين: 60,
  سبعون: 70,
  سبعين: 70,
  ثمانون: 80,
  ثمانين: 80,
  تسعون: 90,
  تسعين: 90,
};

export function normalizeCommercialText(text: string): string {
  return text
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}

function digitAmounts(text: string): string[] {
  return [...normalizeCommercialText(text).matchAll(/\d+(?:[.,]\d+)?/g)].map((match) =>
    match[0].replace(',', '.'),
  );
}

function numberWordAmounts(text: string): string[] {
  const tokens = normalizeCommercialText(text)
    .split(/[^\u0600-\u06FF]+/)
    .map((token) => token.replace(/^و/, ''))
    .filter(Boolean);
  const values: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const hundred = HUNDREDS[current];
    if (hundred != null) {
      const next = tokens[index + 1];
      const rest = next ? TENS[next] ?? ONES[next] : undefined;
      if (rest != null) {
        values.push(String(hundred + rest));
        index += 1;
      } else {
        values.push(String(hundred));
      }
      continue;
    }
    const one = ONES[current];
    const ten = TENS[current];
    if (one == null && ten == null) continue;
    const next = tokens[index + 1];
    if (one != null && next && TENS[next] != null) {
      values.push(String(one + TENS[next]));
      index += 1;
      continue;
    }
    if (ten != null && next && ONES[next] != null) {
      values.push(String(ten + ONES[next]));
      index += 1;
      continue;
    }
    values.push(String(one ?? ten));
  }
  return values;
}

function currencyCodes(text: string): string[] {
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  const codes: string[] = [];
  const sarAbbreviation = /(?<![\u0621-\u064A])ر\s*\.?\s*س(?![\u0621-\u064A])/;
  if (/ريال/.test(normalized) || sarAbbreviation.test(normalized) || /(?<![a-z])sar(?![a-z])/.test(english)) codes.push('SAR');
  if (/[$＄]/.test(text) || /دولار/.test(normalized) || /(?<![a-z])(?:usd|dollar|dollars)(?![a-z])/.test(english)) codes.push('USD');
  if (/(?<![a-z])(?:riyal|riyals)(?![a-z])/.test(english)) codes.push('SAR');
  if (/يورو/.test(normalized) || /(?<![a-z])eur(?![a-z])/.test(english)) codes.push('EUR');
  return codes;
}

function hasPrice(text: string): boolean {
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  const amounts = [...digitAmounts(text), ...numberWordAmounts(text)];
  if (amounts.length === 0) return false;
  if (currencyCodes(text).length > 0) return true;
  const costWord =
    /سعر|ثمن|تكلف|يكلف|مقابل/.test(normalized) ||
    /(?<![a-z])(?:costs?|prices?|priced)(?![a-z])/.test(english);
  if (!costWord) return false;
  const negatedPriceOnly =
    /ليس(?:ت)?\s+سعر/.test(normalized) && !/ثمن|تكلف|يكلف|مقابل/.test(normalized);
  return !negatedPriceOnly;
}

function availabilityPolarity(text: string): 'positive' | 'negative' | 'mixed' | null {
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  const negative =
    /غير\s*متوف|غير\s*متاح|ليس(?:ت)?\s*متوف|ليس(?:ت)?\s*متاح|نفد|نفذ/.test(normalized) ||
    /not\s+available|unavailable|out\s+of\s+stock/.test(english);
  const withoutNegative = normalized.replace(
    /غير\s*متوف\S*|غير\s*متاح\S*|ليس(?:ت)?\s*متوف\S*|ليس(?:ت)?\s*متاح\S*/g,
    ' ',
  );
  const positive =
    /متوف|متاح|جاهز\S*\s+لل(?:شراء|طلب)|موجود\S*\s+في\s+(?:متجر|المتجر)/.test(withoutNegative) ||
    /(?<![a-z])available(?![a-z])|in stock|ready to buy/.test(english);
  if (negative && positive) return 'mixed';
  if (negative) return 'negative';
  if (positive) return 'positive';
  return null;
}

function hasDiscount(text: string): boolean {
  const normalized = normalizeCommercialText(text);
  return /خصم|تخفيض/.test(normalized) || /(?<![a-z])discount(?![a-z])/.test(text.toLowerCase());
}

function hasOpenSlot(text: string): boolean {
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  const booking = /حجز|موعد/.test(normalized) || /(?<![a-z])(?:appointment|booking|book)(?![a-z])/.test(english);
  const when = /ساعه|غد|اليوم|عياده/.test(normalized) || /tomorrow|today|clinic/.test(english);
  return booking && when;
}

export function isCommercialClaim(text: string): boolean {
  return hasPrice(text) || availabilityPolarity(text) != null || hasDiscount(text) || hasOpenSlot(text);
}

export function isBudgetPreference(text: string): boolean {
  const normalized = normalizeCommercialText(text);
  if (!/ميزاني|بحدود|ما\s*يتجاوز|لا\s*يتجاوز/.test(normalized)) return false;
  return !/كم\s+(?:ال)?(?:سعر|ثمن)|بكم|ما\s+(?:ال)?(?:سعر|ثمن)|ارخص|متجر/.test(normalized);
}

export function isDirectCommercialQuestion(text: string): boolean {
  if (isBudgetPreference(text)) return false;
  if (isCommercialClaim(text)) return true;
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  return (
    /كم\s+(?:ال)?(?:سعر|ثمن)|بكم|ما\s+(?:ال)?(?:سعر|ثمن)|ارخص|متجر/.test(normalized) ||
    /how much|what(?:'s| is) the price|does it cost/.test(english)
  );
}

/** A request for care advice. Product names such as واقي or مرطب are not advice requests. */
const CARE_REQUEST = /روتين|نصيح|عنايه|كيف\s*استخدم|استخدم|بشري|حبوب|مسام|درج|حجم|عبو/;
const CARE_REQUEST_EN = /routine|advice|how (?:do|to|should)|(?:^|[^a-z])use(?:[^a-z]|$)|skin|score|package|size|\bml\b/;

/**
 * Approved daily line from the report tips. Used when a question asks for care and a price,
 * so the care half is not taken from free model text.
 */
const SERVER_CARE_AR = 'روتين يومي: تنظيف لطيف، ترطيب، وواقي شمس.';

export function isCareAdviceRequest(text: string): boolean {
  return CARE_REQUEST.test(normalizeCommercialText(text)) || CARE_REQUEST_EN.test(text.toLowerCase());
}

/**
 * A price question that does not also ask for care advice.
 * A product name alone does not make the question mixed. Recognition is structural, not full language coverage.
 */
export function isPureCommercialQuestion(text: string): boolean {
  return isDirectCommercialQuestion(text) && !isCareAdviceRequest(text);
}

export function isMixedCommercialQuestion(text: string): boolean {
  return isDirectCommercialQuestion(text) && isCareAdviceRequest(text);
}

export function serverCommercialReply(facts: MceFactEntry[], userMessage: string): string {
  const asked = compact(userMessage);
  const lines = facts
    .map((fact) => {
      const line = renderCommercialFact(fact);
      const subject = fact.commercial?.subjectAr;
      if (!line || !subject || !asked.includes(compact(subject))) return null;
      return line;
    })
    .filter((line): line is string => Boolean(line));
  const unique = [...new Set(lines)];
  return unique.length > 0 ? unique.join(' ') : COMMERCIAL_GAP_AR;
}

/** Care plus the server commercial line. The model answer is not a source for either half. */
export function serverCommercialTurnReply(facts: MceFactEntry[], userMessage: string): string {
  const commercial = serverCommercialReply(facts, userMessage);
  if (!isCareAdviceRequest(userMessage)) return commercial;
  return `${SERVER_CARE_AR} ${commercial}`;
}

/** An amount that is not a package size or a skin score. Suggestions must not carry it. */
export function hasUntrustedAmount(text: string): boolean {
  if (digitAmounts(text).length === 0 && numberWordAmounts(text).length === 0) return false;
  const normalized = normalizeCommercialText(text);
  const english = text.toLowerCase();
  if (/مل|ملي|جرام/.test(normalized) || /\bml\b|\bmg\b/.test(english)) return false;
  if (/درج|حيوي|مؤشر/.test(normalized) || /score|vitality/.test(english)) return false;
  return true;
}

function compact(text: string): string {
  return normalizeCommercialText(text).replace(/\s+/g, '');
}

export function renderCommercialFact(fact: MceFactEntry): string | null {
  const commercial = fact.commercial;
  if (!commercial?.subjectAr) return null;
  const price =
    commercial.priceAmount && commercial.currency === 'SAR'
      ? `سعر ${commercial.subjectAr} ${commercial.priceAmount} ريال`
      : null;
  const stock =
    commercial.availability === true
      ? 'وهو متوفر'
      : commercial.availability === false
        ? 'وهو غير متوفر'
        : null;
  if (price && stock) return `${price}، ${stock}.`;
  if (price) return `${price}.`;
  if (commercial.availability === true) return `${commercial.subjectAr} متوفر.`;
  if (commercial.availability === false) return `${commercial.subjectAr} غير متوفر.`;
  return null;
}

function sentences(text: string): string[] {
  return text
    .split(/[\n]+|(?<=[.!?؟])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function guardCommercialText(text: string, facts: MceFactEntry[]): { text: string; removed: boolean } {
  const kept: string[] = [];
  const removedText: string[] = [];
  for (const sentence of sentences(text)) {
    const normalized = normalizeCommercialText(sentence);
    const budgetOnly = /ميزاني/.test(normalized) && !/سعر|ثمن|متوف|متاح|خصم|متجر/.test(normalized);
    if (isCommercialClaim(sentence) && !budgetOnly) removedText.push(sentence);
    else kept.push(sentence);
  }
  let next = kept.join(' ').trim();
  if (removedText.length > 0) {
    const rendered = facts
      .map((fact) => {
        const line = renderCommercialFact(fact);
        if (!line || !fact.commercial?.subjectAr) return null;
        return compact(removedText.join(' ')).includes(compact(fact.commercial.subjectAr)) ? line : null;
      })
      .filter((line): line is string => Boolean(line));
    const addition = rendered.length > 0 ? [...new Set(rendered)].join(' ') : COMMERCIAL_GAP_AR;
    if (!next.includes(addition)) next = next ? `${next} ${addition}` : addition;
  }
  return { text: next, removed: removedText.length > 0 };
}

const TRUSTED_SKIN_FALLBACK_AR =
  'لا أعتمد الرقم المكتوب في نص السؤال بدل قياس التقرير. الإجابة تبقى على بيانات التقرير المحفوظة.';

const SKIN_METRICS: Array<{ ids: string[]; mention: RegExp }> = [
  { ids: ['skin.moisture', 'moisture', 'hydration'], mention: /ترطيب|رطوب|(?<![a-z])(?:hydration|moisture)(?![a-z])/ },
  { ids: ['skin.pore', 'pore', 'pores'], mention: /مسام|(?<![a-z])pores?(?![a-z])/ },
  { ids: ['skin.oiliness', 'oiliness'], mention: /دهون|زيوت|(?<![a-z])oiliness(?![a-z])/ },
  { ids: ['skin.wrinkle', 'wrinkle', 'wrinkles'], mention: /تجاعيد|(?<![a-z])wrinkles?(?![a-z])/ },
  { ids: ['skin.acne', 'acne'], mention: /حبوب|(?<![a-z])acne(?![a-z])/ },
  { ids: ['skin.spot', 'age_spot', 'pigment'], mention: /بقع|تصبغ|(?<![a-z])(?:spots?|pigmentation)(?![a-z])/ },
  { ids: ['skin.redness', 'redness'], mention: /احمرار|(?<![a-z])redness(?![a-z])/ },
  { ids: ['skin.texture', 'texture'], mention: /ملمس|(?<![a-z])texture(?![a-z])/ },
];

function canonicalAmount(raw: string): string {
  const normalized = raw.replace(',', '.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return normalized;
  return Number.isInteger(value) ? String(value) : String(value);
}

function trustedMetricValues(metric: (typeof SKIN_METRICS)[number], facts: MceFactEntry[]): Set<string> | null {
  const hits = facts.filter((fact) => {
    const label = normalizeCommercialText(fact.labelAr).toLowerCase();
    return metric.ids.includes(fact.id) || metric.mention.test(label);
  });
  if (hits.length === 0) return null;
  const values = new Set<string>();
  for (const fact of hits) {
    for (const amount of [...digitAmounts(fact.valueAr), ...numberWordAmounts(fact.valueAr)]) {
      values.add(canonicalAmount(amount));
    }
  }
  return values;
}

function locatedAmounts(working: string): Array<{ value: string; start: number }> {
  const found: Array<{ value: string; start: number }> = [];
  for (const match of working.matchAll(/\d+(?:\.\d+)?/g)) {
    const after = working.slice((match.index ?? 0) + match[0].length, (match.index ?? 0) + match[0].length + 8);
    if (/^\s*(?:مل|ملي|جرام|ml|mg|g)(?![a-z\u0621-\u064A])/.test(after)) continue;
    const before = working.slice(Math.max(0, (match.index ?? 0) - 8), match.index ?? 0);
    if (/(?:من|\/|out of)\s*$/.test(before) && canonicalAmount(match[0]) === '100') continue;
    found.push({ value: canonicalAmount(match[0]), start: match.index ?? 0 });
  }
  const tokens = [...working.matchAll(/[\u0621-\u064A]+/g)].map((match) => ({
    token: match[0].replace(/^و/, ''),
    start: match.index ?? 0,
  }));
  for (let index = 0; index < tokens.length; index += 1) {
    const current = tokens[index];
    const hundred = HUNDREDS[current.token];
    if (hundred != null) {
      const next = tokens[index + 1];
      const rest = next ? TENS[next.token] ?? ONES[next.token] : undefined;
      found.push({ value: String(rest == null ? hundred : hundred + rest), start: current.start });
      if (rest != null) index += 1;
      continue;
    }
    const one = ONES[current.token];
    const ten = TENS[current.token];
    if (one == null && ten == null) continue;
    const next = tokens[index + 1];
    if (one != null && next && TENS[next.token] != null) {
      found.push({ value: String(one + TENS[next.token]), start: current.start });
      index += 1;
      continue;
    }
    if (ten != null && next && ONES[next.token] != null) {
      found.push({ value: String(ten + ONES[next.token]), start: current.start });
      index += 1;
      continue;
    }
    found.push({ value: String(one ?? ten), start: current.start });
  }
  return found;
}

function claimParts(sentence: string): string[] {
  return sentence
    .split(/(?<=\d)\s*و(?=\S)|(?<=\s)و(?=ال(?:ترطيب|مسام|دهون|تجاعيد|حبوب|بقع|احمرار|ملمس))| and (?=(?:the )?(?:hydration|moisture|pores?|oiliness)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function skinClaimKept(part: string, facts: MceFactEntry[]): boolean {
  const working = normalizeCommercialText(part).toLowerCase();
  const mentions = SKIN_METRICS.flatMap((metric, spec) =>
    [...working.matchAll(new RegExp(metric.mention.source, 'g'))].map((match) => ({
      spec,
      start: match.index ?? 0,
    })),
  );
  const amounts = locatedAmounts(working);
  if (amounts.length === 0) return true;
  const personal = /ترطيبك|درجتك|نتيجتك|تقريرك|قياسك|بشرتك/.test(working);
  const indicative = /تقريب|عاده|غالبا|غالب|ارشاد|بشكل عام|قد يكون|قد يصل/.test(working);
  if (indicative && !personal) return true;
  if (mentions.length === 0) {
    const generic = /درج|مؤشر|(?<![a-z])score(?![a-z])/.test(working);
    if (!generic) return true;
    const supporters = facts.filter((fact) =>
      normalizeCommercialText(fact.labelAr)
        .toLowerCase()
        .split(/[^\u0621-\u064Aa-z0-9]+/)
        .flatMap((token) => [token, token.replace(/^ال/, '')])
        .filter((token) => token.length >= 3)
        .some((token) => working.includes(token)),
    );
    return supporters.length > 0 && amounts.every((amount) =>
      supporters.some((fact) => {
        const values = new Set([...digitAmounts(fact.valueAr), ...numberWordAmounts(fact.valueAr)].map(canonicalAmount));
        return values.has(amount.value);
      }),
    );
  }
  return amounts.every((amount) => {
    const nearest = mentions.reduce((best, mention) =>
      Math.abs(mention.start - amount.start) < Math.abs(best.start - amount.start) ? mention : best,
    );
    const values = trustedMetricValues(SKIN_METRICS[nearest.spec], facts);
    return values != null && values.has(amount.value);
  });
}

/**
 * A skin number is trusted only for the metric named beside it.
 * Values come from that fact's valueAr. Another metric, a price, a date, or an id does not vouch for it.
 */
export function retainTrustedSkinNumbers(answer: string, facts: MceFactEntry[]): string {
  const kept: string[] = [];
  for (const sentence of sentences(answer)) {
    const parts = claimParts(sentence).filter((part) => skinClaimKept(part, facts));
    if (parts.length > 0) kept.push(parts.join(' '));
  }
  return kept.join(' ').trim() || TRUSTED_SKIN_FALLBACK_AR;
}

export function guardCommercialTurn(
  answer: string,
  facts: MceFactEntry[],
  userMessage?: string,
): { text: string; removed: boolean } {
  if (userMessage && isDirectCommercialQuestion(userMessage)) {
    return { text: serverCommercialTurnReply(facts, userMessage), removed: true };
  }
  const guarded = guardCommercialText(answer, facts);
  if (userMessage && !isDirectCommercialQuestion(userMessage)) {
    const stripped = guarded.text.replace(COMMERCIAL_GAP_AR, '').replace(/\s+/g, ' ').trim();
    if (stripped) return { text: stripped, removed: guarded.removed || stripped !== guarded.text };
  }
  return guarded;
}
