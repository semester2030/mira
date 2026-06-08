import { AdvisorContext } from '../contracts/advisor-context.interface';

export function explainTopProduct(ctx: AdvisorContext): string {
  const product = ctx.products[0];
  if (!product) {
    return 'لم نجد منتجاً موصى به في تقريرك الحالي — ركزي أولاً على الروتين اليومي (تنظيف · ترطيب · واقي شمس).';
  }
  return explainProductByName(ctx, product.nameAr);
}

export function explainProductByName(
  ctx: AdvisorContext,
  nameHint: string,
): string {
  const product =
    ctx.products.find((p) => p.nameAr.includes(nameHint) || nameHint.includes(p.nameAr)) ??
    ctx.products[0];

  if (!product) {
    return explainTopProduct(ctx);
  }

  const concerns = ctx.mainConcernLabels.slice(0, 2).join(' · ');
  const skin = ctx.skinTypeAr;

  if (/vitamin|فيتامين|c|سي\b/i.test(product.nameAr)) {
    return (
      `لماذا أوصت ميرا بـ«${product.nameAr}»؟\n` +
      `لأن تقريرك (${skin}) يظهر اهتماماً بـ${concerns || 'توازن البشرة'}، ` +
      `وسيروم فيتامين C يساعد عادةً في دعم الإشراق وتوحيد المظهر العام — ` +
      `ليس كعلاج طبي. ${product.stepAr ? `الخطوة: ${product.stepAr}.` : ''}`
    );
  }

  if (/hydr|ترط|moist/i.test(product.nameAr)) {
    return (
      `«${product.nameAr}» اختير لأن مؤشرات الترطيب في تحليلك تحتاج دعماً — ` +
      `وهو يناسب بشرة ${skin}. ` +
      `التطابق مع تقريرك: ${product.matchScore}/100.`
    );
  }

  return (
    `«${product.nameAr}» من شركاء ميرا — مبني على concerns تقريرك (${concerns || 'عناية عامة'}) ` +
    `ونوع بشرتك ${skin}. التطابق: ${product.matchScore}/100. ` +
    `${product.stepAr ? `استخدميه: ${product.stepAr}.` : ''}`
  );
}

export function answerBestProduct(ctx: AdvisorContext): string {
  if (ctx.products.length === 0) {
    return 'ابدئي بالروتين اليومي في تقريرك — غسول لطيف · مرطب · SPF 50. المنتجات تظهر عندما يكون لديكِ تحليل محفوظ.';
  }

  const top = ctx.products.slice(0, 2);
  const lines = top.map(
    (p, i) => `${i + 1}. ${p.nameAr} (تطابق ${p.matchScore}/100)`,
  );

  return (
    `أفضل منتجات ميرا لكِ الآن — بناءً على تحليلك:\n${lines.join('\n')}\n\n` +
    explainProductByName(ctx, top[0].nameAr)
  );
}
