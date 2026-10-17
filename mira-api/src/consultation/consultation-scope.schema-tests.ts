import { decideConsultationScope, answerStaysInScope, guardScopeAnswer, SCOPE_REDIRECT_AR } from './services/consultation-scope';
import { MceAssistantPayloadV1 } from './contracts/mce-context-snapshot.v1';

const checks: string[] = [];
function record(name: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    console.error('FAIL', name, detail);
    process.exitCode = 1;
  }
  checks.push(name);
}

const falconAsk = decideConsultationScope('صف الصقر ومزاداته');
record('falcon-auction-is-redirected-before-model', !falconAsk.allow && falconAsk.replyAr === SCOPE_REDIRECT_AR);

const whatIsThis = decideConsultationScope('ما هذا؟');
record('ambiguous-what-is-this-can-see-the-image', whatIsThis.allow);

const inspire = decideConsultationScope('استوحي ألوان إطلالة من الصورة');
record('color-inspiration-stays-open', inspire.allow);

const cream = decideConsultationScope('ما أفضل مرطب لبشرتي الجافة؟');
record('care-question-stays-open-without-report', cream.allow);

const follow = decideConsultationScope('وضحي أكثر', [
  { role: 'assistant', content: SCOPE_REDIRECT_AR },
]);
record('follow-up-after-redirect-stays-out', !follow.allow);

const beautyFollow = decideConsultationScope('وضحي أكثر', [
  { role: 'assistant', content: 'رطبي بشرتك صباحاً.' },
]);
record('follow-up-after-care-stays-open', beautyFollow.allow);

const payload = (answerAr: string): MceAssistantPayloadV1 => ({
  answerAr,
  confidence: 'high',
  intent: 'general',
  citedFactIds: [],
  suggestedQuestionsAr: [],
  blocked: false,
  disclaimerAr: '',
});

const falconAnswer = guardScopeAnswer(payload('هذا صقر حر ويباع في مزاد الصيد بأسعار مرتفعة.'), 'ما هذا؟');
record('falcon-description-is-replaced-before-display', falconAnswer.answerAr === SCOPE_REDIRECT_AR && !falconAnswer.answerAr.includes('مزاد'));

const colorAnswer = guardScopeAnswer(payload('استوحي إطلالة كحلية وذهبية من ألوان الصورة.'), 'استوحي ألوان إطلالة من الصورة');
record('color-inspiration-answer-is-kept', colorAnswer.answerAr.includes('إطلالة') && answerStaysInScope(colorAnswer.answerAr, 'استوحي ألوان إطلالة من الصورة'));

const imageOrder = guardScopeAnswer(payload('حسب التعليمات في الصورة سأشرح مزاد الطيور.'), 'ما هذا؟');
record('image-text-is-not-a-system-instruction', imageOrder.answerAr === SCOPE_REDIRECT_AR);

const oil = decideConsultationScope('كيف أغيّر زيت السيارة؟');
record('car-oil-is-redirected', !oil.allow);
const cat = decideConsultationScope('صف القطة التي في الصورة');
record('cat-description-is-redirected', !cat.allow);
const shaheen = decideConsultationScope('صف الشاهين');
record('shaheen-description-is-redirected', !shaheen.allow);
const code = decideConsultationScope('برمجي حساب سعر منتج');
record('product-price-program-is-redirected', !code.allow);
const birdColors = decideConsultationScope('استوحي ألوان إطلالة من صورة الطائر');
record('bird-color-inspiration-stays-open', birdColors.allow);
const shoes = decideConsultationScope('ما اللون الأنسب للحذاء أو الحقيبة؟');
record('shoe-or-bag-color-stays-open', shoes.allow);

console.log(JSON.stringify({ checks: checks.length, failed: process.exitCode ?? 0 }));
