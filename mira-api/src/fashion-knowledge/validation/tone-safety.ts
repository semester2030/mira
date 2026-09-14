/**
 * FK-2 — Tone safety validator (prohibited semantic categories).
 */
export interface ToneSafetyIssue {
  readonly code:
    | 'ABSOLUTE_WRONG'
    | 'ATTRACTIVENESS'
    | 'BODY_SHAMING'
    | 'BODY_SHAPE_JUDGMENT'
    | 'MEDICAL'
    | 'SOCIAL_STATUS'
    | 'PROVIDER_LEAKAGE'
    | 'GENDER_STEREOTYPE'
    | 'CHEAP_LOOKING_JUDGMENT'
    | 'FAKE_ETIQUETTE_AUTHORITY'
    | 'CULTURAL_STEREOTYPE'
    | 'RELIGIOUS_RULING'
    | 'CULTURAL_ESSENTIALISM'
    | 'MORAL_SHAME_LANGUAGE';
  readonly message: string;
}

const ATTRACTIVENESS =
  /attractiveness|أكثر جمال|أقل جاذبية|beautiful by\s*\d|beauty\s*%|أكثر جاذبية|أقل جمال|makes you (un)?attractive|makes you more attractive|more beautiful|more attractive|less attractive/i;

const BODY =
  /you look (fat|thin|ugly)|تبدين (سمينة|نحيفة)|body shaming|وزنك|مظهرك الجسدي المعيب/i;

/** FK-7 Law #37 — garment proportion ≠ body correction / attractiveness. */
const BODY_SHAPE =
  /makes you look (thinner|slimmer|taller|shorter)|hides your (stomach|hips|arms|legs)|makes your (legs longer|waist smaller)|fixes your body|flatters your body|ideal body|pear body|apple body|hourglass (is better|body)|body[- ]shape (advice|hierarchy)|يخفي البطن|يجعلك أنحف|يطيل الساقين/i;

const MEDICAL =
  /diagnos|وصفة طبية|علاج طبي|medical condition|بشرة مريضة|skin disease treatment/i;

const ABSOLUTE_WRONG =
  /\bthis is wrong\b|\bthis (bag|shoe|accessory|jewelry) is wrong\b|هذا خطأ|لا يناسبك مطلقًا|does not suit you|these accessories do not suit you|you must not wear|gold is always better|silver never works|definitely correct/i;

const SOCIAL =
  /\bsocially inappropriate\b|يقلل من مكانتك|lowers your status|طبقية/i;

const PROVIDER =
  /\bfashn\b|openai|provider_id|vision provider|raw provider payload/i;

const GENDER =
  /\bwomen should wear\b|\bmen should wear\b|النساء يجب|الرجال يجب|real (women|men) wear/i;

const CHEAP =
  /\bcheap[- ]looking\b|يبدو رخيص|يظهر رخيصًا|looks cheap\b/i;

const FAKE_ETIQUETTE =
  /\betiquette demands\b|according to etiquette you must\b|قواعد الإتيكيت تفرض|etiquette authority/i;

/** FK-8 Law #38 — culture is context, never identity or moral authority. */
const CULTURAL_STEREOTYPE =
  /\bsaudi women (usually|should|must)\b|\bwomen in (saudi|gulf|riyadh) should\b|because (she|the user) is arabic|because (location|locale) is (riyadh|saudi)|العربيات يجب|السعوديات عادة|لأنها عربية|لأن الموقع الرياض/i;

const RELIGIOUS_RULING =
  /\b(halal|haram)\b|مخالفة دينيًا|حكم شرعي|religiously (forbidden|required)|according to (islam|religion) (you|she) (must|should)|فتوى أزياء|religious compliance/i;

const CULTURAL_ESSENTIALISM =
  /\ball (saudis|gulf|arabs) (wear|prefer|must)|كل السعوديين|الثقافة تفرض دائمًا|culture (always|never) requires/i;

const MORAL_SHAME =
  /\bimproper woman\b|\bdisrespectful woman\b|\bgood girl\b|\bbad girl\b|\bproper woman\b|امرأة غير لائقة|عار عليك|shameful (outfit|woman)/i;

export function validateToneSafety(text: string): ToneSafetyIssue[] {
  const issues: ToneSafetyIssue[] = [];
  if (ATTRACTIVENESS.test(text)) {
    issues.push({
      code: 'ATTRACTIVENESS',
      message: 'Attractiveness / beauty percentage language is prohibited',
    });
  }
  if (BODY.test(text)) {
    issues.push({
      code: 'BODY_SHAMING',
      message: 'Body-shaming language is prohibited',
    });
  }
  if (BODY_SHAPE.test(text)) {
    issues.push({
      code: 'BODY_SHAPE_JUDGMENT',
      message:
        'Body-shape / slimming / flattering-body claims are prohibited (Law #37)',
    });
  }
  if (MEDICAL.test(text)) {
    issues.push({
      code: 'MEDICAL',
      message: 'Medical claim language is prohibited',
    });
  }
  if (ABSOLUTE_WRONG.test(text)) {
    issues.push({
      code: 'ABSOLUTE_WRONG',
      message: 'Absolute taste judgment is prohibited',
    });
  }
  if (SOCIAL.test(text)) {
    issues.push({
      code: 'SOCIAL_STATUS',
      message: 'Social-status judgment is prohibited',
    });
  }
  if (PROVIDER.test(text)) {
    issues.push({
      code: 'PROVIDER_LEAKAGE',
      message: 'Provider / execution metadata leakage is prohibited',
    });
  }
  if (GENDER.test(text)) {
    issues.push({
      code: 'GENDER_STEREOTYPE',
      message: 'Gender stereotype language is prohibited',
    });
  }
  if (CHEAP.test(text)) {
    issues.push({
      code: 'CHEAP_LOOKING_JUDGMENT',
      message: 'Cheap-looking personal judgment is prohibited',
    });
  }
  if (FAKE_ETIQUETTE.test(text)) {
    issues.push({
      code: 'FAKE_ETIQUETTE_AUTHORITY',
      message: 'Fake etiquette authority claims are prohibited',
    });
  }
  if (CULTURAL_STEREOTYPE.test(text)) {
    issues.push({
      code: 'CULTURAL_STEREOTYPE',
      message: 'Cultural stereotype / identity inference language is prohibited (Law #38)',
    });
  }
  if (RELIGIOUS_RULING.test(text)) {
    issues.push({
      code: 'RELIGIOUS_RULING',
      message: 'Religious fashion rulings are out of Fashion Knowledge scope',
    });
  }
  if (CULTURAL_ESSENTIALISM.test(text)) {
    issues.push({
      code: 'CULTURAL_ESSENTIALISM',
      message: 'Cultural essentialism is prohibited (Law #38)',
    });
  }
  if (MORAL_SHAME.test(text)) {
    issues.push({
      code: 'MORAL_SHAME_LANGUAGE',
      message: 'Moral shame / proper-woman framing is prohibited',
    });
  }
  return issues;
}
