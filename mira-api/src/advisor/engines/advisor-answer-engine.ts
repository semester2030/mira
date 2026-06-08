import { AdvisorContext } from '../contracts/advisor-context.interface';
import {
  AdvisorChatResponse,
  AdvisorConfidence,
  ADVISOR_DISCLAIMER_AR,
} from '../contracts/advisor-response.interface';
import {
  answerBestProduct,
  explainProductByName,
  explainTopProduct,
} from './recommendation-explainer';
import { explainRoutineStep, summarizeRoutine } from './routine-advisor';

export type AdvisorIntent =
  | 'serum'
  | 'retinol'
  | 'vitamin_c'
  | 'pores'
  | 'dark_circles'
  | 'hydration'
  | 'product_why'
  | 'best_product'
  | 'routine_why'
  | 'routine_summary'
  | 'clinic'
  | 'occasion'
  | 'maintain'
  | 'general';

export function buildAdvisorAnswer(
  ctx: AdvisorContext,
  message: string,
): AdvisorChatResponse {
  const intent = detectIntent(message);
  const answer = composeAnswer(ctx, intent, message);
  const confidence = scoreConfidence(ctx, intent);
  const suggestedQuestions = buildSuggestedQuestions(ctx, intent);

  return {
    answer: `${answer}\n\n${ADVISOR_DISCLAIMER_AR}`,
    suggestedQuestions,
    confidence,
    intent,
  };
}

function detectIntent(message: string): AdvisorIntent {
  const t = message.toLowerCase();

  if (/retinol|رتinol|ريتين|tretinoin/i.test(t)) return 'retinol';
  if (/vitamin\s*c|فيتامين\s*سي|vit c/i.test(t)) return 'vitamin_c';
  if (/سيروم|serum/i.test(t)) return 'serum';
  if (/مسام|pore/i.test(t)) return 'pores';
  if (/هالات|dark\s*circle|تحت\s*العين/i.test(t)) return 'dark_circles';
  if (/ترط|جفاف|hydr|moist/i.test(t)) return 'hydration';
  if (/لماذا.*(منتج|product)|why.*product|سبب.*توص/i.test(t)) return 'product_why';
  if (/أفضل\s*منتج|best\s*product|منتجات\s*ميرا/i.test(t)) return 'best_product';
  if (/لماذا.*(روتين|واقي|spf|غسول)|why.*routine|why.*sun/i.test(t)) return 'routine_why';
  if (/روتين|routine|خطوات/i.test(t)) return 'routine_summary';
  if (/عيادة|clinic|طبيب|dermat|جلد/i.test(t)) return 'clinic';
  if (/مناسب|occasion|قبل\s*ال/i.test(t)) return 'occasion';
  if (/حافظ|maintain|النتائج|استمر/i.test(t)) return 'maintain';

  return 'general';
}

function composeAnswer(
  ctx: AdvisorContext,
  intent: AdvisorIntent,
  message: string,
): string {
  switch (intent) {
    case 'serum':
      return answerSerum(ctx);
    case 'retinol':
      return answerRetinol(ctx);
    case 'vitamin_c':
      return answerVitaminC(ctx);
    case 'pores':
      return answerPores(ctx);
    case 'dark_circles':
      return answerDarkCircles(ctx);
    case 'hydration':
      return answerHydration(ctx);
    case 'product_why':
      return explainTopProduct(ctx);
    case 'best_product':
      return answerBestProduct(ctx);
    case 'routine_why': {
      const step =
        explainRoutineStep(ctx, 'spf') ??
        explainRoutineStep(ctx, 'سيروم') ??
        explainRoutineStep(ctx, 'غسول') ??
        summarizeRoutine(ctx);
      return step;
    }
    case 'routine_summary':
      return summarizeRoutine(ctx);
    case 'clinic':
      return answerClinic(ctx);
    case 'occasion':
      return answerOccasion(ctx);
    case 'maintain':
      return answerMaintain(ctx);
    default:
      return answerGeneral(ctx, message);
  }
}

function answerSerum(ctx: AdvisorContext): string {
  const topConcern = ctx.mainConcernLabels[0] ?? 'توازن البشرة';
  const hasMoistureNeed = ctx.mainConcernIds.includes('moisture');

  if (hasMoistureNeed || ctx.mainConcernIds.includes('wrinkle')) {
    return (
      `بناءً على تحليلك (بشرة ${ctx.skinTypeAr} · ${topConcern}) — نعم، سيروم ترطيب أو فيتامين C ` +
      `قد يساعد كخطوة إضافية بعد الغسول وقبل المرطب. ` +
      (ctx.products[0]
        ? `منتجك الموصى به: ${ctx.products[0].nameAr}.`
        : 'راجعي قسم المنتجات في تقريرك.')
    );
  }

  return (
    `سيروم ليس ضرورياً للجميع — لكن مع ${topConcern} في تقريرك، ` +
    `طبقة سيروم خفيفة (${ctx.routineMorning.includes('سيروم') ? 'موجودة في روتينك' : 'يمكن إضافتها'}) ` +
    `قد تدعم روتينك الحالي.`
  );
}

function answerRetinol(ctx: AdvisorContext): string {
  if (ctx.isMinor) {
    return 'ريتينول غير مناسب للمراهقات في ميرا — ركزي على غسول لطيف · مرطب · SPF. استشيري وليّ الأمر أو طبيبة جلدية عند الحاجة.';
  }

  const wrinkles = ctx.mainConcernIds.includes('wrinkle');
  const acne = ctx.mainConcernIds.includes('acne');

  if (wrinkles || ctx.userAge != null && ctx.userAge >= 28) {
    return (
      `ريتينول قد يناسبكِ تدريجياً (مساءً · 2–3 مرات أسبوعياً للبداية) — ` +
      `لأن تقريرك يظهر اهتماماً بـ${ctx.mainConcernLabels.find((l) => l.includes('تجاع')) ?? 'علامات التقدم'}. ` +
      `ابدئي بتركيز منخفض · SPF إلزامي · توقفي عند تهيّج.`
    );
  }

  if (acne) {
    return 'للحبوب، نياسيناميد أو BPO خفيف قد يناسبان أكثر من ريتينول قوي في البداية — حسب شدة تقريرك.';
  }

  return (
    'ريتينول ليس ضرورياً الآن — روتينك الحالي (تنظيف · ترطيب · SPF) كافٍ للحفاظ على توازن بشرتك. ' +
    'أضيفيه لاحقاً فقط إذا ظهرت حاجة أوضح في تحليلات متتابعة.'
  );
}

function answerVitaminC(ctx: AdvisorContext): string {
  const product = ctx.products.find((p) => /vitamin|فيتامين| c/i.test(p.nameAr));
  if (product) {
    return explainProductByName(ctx, product.nameAr);
  }
  return (
    `فيتامين C صباحاً قد يساعد مع ${ctx.mainConcernLabels.slice(0, 2).join(' · ') || 'إشراق البشرة'} — ` +
    `بعد الغسول وقبل SPF. ليس بديلاً عن واقي الشمس.`
  );
}

function answerPores(ctx: AdvisorContext): string {
  return (
    `اتساع المسام في تقريرك مرتبط غالباً بـ${ctx.skinTypeAr} ` +
    `و${ctx.mainConcernLabels.find((l) => l.includes('مسام')) ?? 'إفراز الدهون'}. ` +
    `BHA خفيف 1–2 مرات أسبوعياً · تنظيف لطيف · تجنّبي over-cleansing. ` +
    `النتائج تحتاج 4–8 أسابيع ثباتاً.`
  );
}

function answerDarkCircles(ctx: AdvisorContext): string {
  return (
    `الهالات قد تتأثر بالنوم · الترطيب · الحساسية — ` +
    `تقريرك لا يعطي تشخيصاً موضعياً «هنا بالضبط». ` +
    `بناءً على scores عامة: ${ctx.mainConcernLabels.slice(0, 2).join(' · ') || 'الترطيب'} — ` +
    `مرطب تحت العين + SPF + نوم كافٍ. للهالات العنيدة، طبيبة جلدية قد تساعد.`
  );
}

function answerHydration(ctx: AdvisorContext): string {
  return (
    `ترطيبك (${ctx.skinTypeAr}): ${ctx.routineMorning.join(' · ')} صباحاً. ` +
    `${ctx.progressSummary ? `تقدّمك: ${ctx.progressSummary}. ` : ''}` +
    `اشربي ماء كافياً — الترطيب يبدأ من الداخل أيضاً.`
  );
}

function answerClinic(ctx: AdvisorContext): string {
  const severe = ctx.mainConcernIds.some((id) =>
    ['acne', 'redness', 'age_spot'].includes(id),
  );
  if (severe) {
    return (
      'إذا لاحظتِ تهيّجاً مستمراً أو حبوباً شديدة — جلسة عند طبيبة جلدية فكرة جيدة. ' +
      'ميرا تكمّل العناية المنزلية — لا تستبدل الطبيب.'
    );
  }
  return (
    'روتينك الحالي + منتجات الشركاء قد تكفي — جلسة عيادة تجميلية اختيارية للتقشير أو HydraFacial ' +
    'إذا رغبتِ بدفعة إضافية قبل مناسبة.'
  );
}

function answerOccasion(ctx: AdvisorContext): string {
  return (
    `قبل مناسبة: ثبّتي روتينك 7–14 يوماً · ` +
    `${ctx.weeklyHeadline ?? 'اتبعي خطتك الأسبوعية'} · ` +
    `لا تجربي منتجات جديدة قبل 48 ساعة من المناسبة. ` +
    `SPF يومياً يحافظ على مظهر متجانس.`
  );
}

function answerMaintain(ctx: AdvisorContext): string {
  const pf = ctx.report.progressForecast;
  if (pf.enabled && pf.trends.some((t) => t.direction === 'improved')) {
    return (
      `رائع — ${ctx.progressSummary ?? 'نلاحظ تحسناً'}. ` +
      `حافظي على: ${ctx.routineMorning.filter((s) => /spf|شمس/i.test(s)).join(' · ') || 'SPF'} · ` +
      `نفس روتين AM/PM · تحليل متابعة بعد أسبوعين.`
    );
  }
  return (
    `للحفاظ على النتائج: SPF يومياً · روتين ثابت · ` +
    `تحليل ثانٍ بعد أسبوعين لقياس التقدم في مira.`
  );
}

function answerGeneral(ctx: AdvisorContext, message: string): string {
  const intro = `بشرتك ${ctx.skinTypeAr}`;
  const age =
    ctx.userAge != null && ctx.skinAge != null
      ? ` · عمرك ${ctx.userAge} · عمر البشرة ~${ctx.skinAge}`
      : '';
  const concerns = ctx.mainConcernLabels.slice(0, 3).join(' · ');

  return (
    `سؤالك: «${message.trim().slice(0, 80)}»\n` +
    `${intro}${age}. أهم ما نركز عليه: ${concerns || 'التوازن العام'}. ` +
    `اسأليني عن سيروم · روتين · منتج محدد · أو كيف تحافظين على النتائج.`
  );
}

function scoreConfidence(
  ctx: AdvisorContext,
  intent: AdvisorIntent,
): AdvisorConfidence {
  if (intent === 'general') return 'medium';
  if (ctx.mainConcernIds.length === 0) return 'medium';
  if (['dark_circles', 'clinic'].includes(intent)) return 'medium';
  return 'high';
}

export function buildSuggestedQuestions(
  ctx: AdvisorContext,
  askedIntent: AdvisorIntent,
): string[] {
  const pool: { intent: AdvisorIntent; q: string }[] = [
    { intent: 'serum', q: 'هل أحتاج سيروم؟' },
    { intent: 'retinol', q: 'هل يناسبني الريتينول؟' },
    { intent: 'pores', q: 'كيف أحسّن المسام؟' },
    { intent: 'dark_circles', q: 'كيف أحسّن الهالات؟' },
    { intent: 'maintain', q: 'كيف أحافظ على النتائج؟' },
    { intent: 'best_product', q: 'ما أفضل منتج من ميرا لي؟' },
    { intent: 'routine_why', q: 'لماذا وضعتِ واقي الشمس؟' },
    { intent: 'clinic', q: 'هل أحتاج جلسة عيادة؟' },
  ];

  return pool
    .filter((p) => p.intent !== askedIntent)
    .slice(0, 3)
    .map((p) => p.q);
}
