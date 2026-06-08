import { AdvisorContext } from '../contracts/advisor-context.interface';

export function explainRoutineStep(
  ctx: AdvisorContext,
  keyword: string,
): string | null {
  const key = keyword.toLowerCase();
  const allSteps = [
    ...ctx.report.dailyRoutine.morning,
    ...ctx.report.dailyRoutine.evening,
  ];

  const step = allSteps.find(
    (s) =>
      s.nameAr.includes(keyword) ||
      s.nameEn.toLowerCase().includes(key) ||
      s.stepAr.includes(keyword) ||
      (key.includes('spf') && /spf|شمس|sun/i.test(s.nameAr + s.nameEn)) ||
      (key.includes('سيروم') && /serum|سيروم/i.test(s.nameAr + s.nameEn)) ||
      (key.includes('غس') && /cleans|غس/i.test(s.nameAr + s.nameEn)),
  );

  if (!step) return null;

  if (/spf|شمس|sun/i.test(step.nameAr + step.nameEn + step.stepAr)) {
    return (
      `وضعتُ «${step.nameAr}» في روتينك لأن الحفاظ على نتائجك الحالية ` +
      `(بشرة ${ctx.skinTypeAr}) يعتمد على تقليل تأثير الأشعة فوق البنفسجية. ` +
      `${step.stepAr}`
    );
  }

  if (/serum|سيروم|ترط|hydr/i.test(step.nameAr + step.nameEn)) {
    return (
      `«${step.nameAr}» يدعم ${ctx.mainConcernLabels[0] ?? 'توازن بشرتك'} — ` +
      `طبقة خفيفة بعد التنظيف. ${step.stepAr}`
    );
  }

  return (
    `«${step.nameAr}» جزء من روتينك المخصص — ${step.stepAr}. ` +
    `يتماشى مع نوع بشرتك ${ctx.skinTypeAr}.`
  );
}

export function summarizeRoutine(ctx: AdvisorContext): string {
  const am = ctx.routineMorning.join(' · ') || '—';
  const pm = ctx.routineEvening.join(' · ') || '—';
  return (
    `روتينك من تقرير ميرا:\n` +
    `☀️ الصباح: ${am}\n` +
    `🌙 المساء: ${pm}\n` +
    `الثبات أهم من إضافة خطوات كثيرة.`
  );
}
