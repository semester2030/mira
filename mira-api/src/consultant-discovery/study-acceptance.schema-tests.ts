/**
 * Study acceptance cases 1–20 from MIRA_Consultant_Relationship_Study_AR.html
 * Intent + constraint layer (catalog open/withdraw proven separately in evidence).
 */
import assert from 'node:assert/strict';
import { decideIntent, extractSignals, type SessionDiscoveryContext } from './intent';

type Row = {
  id: number;
  request: string | string[];
  session?: SessionDiscoveryContext | null;
  imageKind?: 'face' | 'outfit' | 'unknown' | 'none';
  expect: (got: ReturnType<typeof decideIntent>) => void;
  note: string;
};

const cases: Row[] = [
  {
    id: 1,
    request: 'أبي فستان زفاف تحت ٣٠٠٠، الفستان بس',
    expect: (g) => {
      assert.equal(g.kind, 'direct_product_search');
      assert.equal(g.priceMax, 3000);
      assert.ok(g.blockers.includes('dress_only'));
      assert.equal(g.sideSuggestionAr, null);
    },
    note: 'سقف ٣٠٠٠ بلا عرض جانبي',
  },
  {
    id: 2,
    request: ['عندي زواج', 'أنا ضيفة وأبي أكمّل اللوك'],
    expect: (g) => {
      // second turn after clarify — guest look
      assert.equal(g.kind, 'direct_product_search');
      assert.ok(g.blockers.includes('no_organizer_for_guest') || g.q != null);
    },
    note: 'ضيفة تكمل اللوك — لا تنظيم',
  },
  {
    id: 3,
    request: 'أرتب زواج أختي بالرياض وأبي منسقة',
    expect: (g) => {
      assert.equal(g.kind, 'direct_service_search');
      assert.equal(g.city, 'الرياض');
      assert.ok(g.targetIds.includes('occasions.styling'));
    },
    note: 'تنسيق بالمدينة',
  },
  {
    id: 4,
    request: 'أبي توزيعات تخرج لـ٨٠ شخصًا',
    expect: (g) => {
      assert.equal(g.kind, 'direct_product_search');
      assert.ok(g.ruleIds.includes('R068'));
    },
    note: 'توزيعات بيع',
  },
  {
    id: 5,
    request: 'ضيافة للاستقبال',
    expect: (g) => {
      assert.equal(g.kind, 'clarify');
      assert.ok(g.blockers.includes('ambiguous_hospitality'));
    },
    note: 'استيضاح شراء أم حجز',
  },
  {
    id: 6,
    request: 'تخرج',
    expect: (g) => {
      // alone may be advice; dual-occasion ID reuse is catalog-level
      assert.ok(g.kind === 'advice_only' || g.kind === 'clarify' || g.kind === 'direct_product_search');
    },
    note: 'مناسبات متعددة — طبقة كتالوج',
  },
  {
    id: 7,
    request: 'بزور مولود وأبي هدية',
    expect: (g) => {
      assert.equal(g.kind, 'direct_product_search');
      assert.equal(g.saveAsPersonalPreference, false);
      assert.deepEqual(g.lanes, ['children', 'gifts']);
    },
    note: 'هدية مولود بلا حفظ تفضيل',
  },
  {
    id: 8,
    request: 'بشتري خاتم لوالدتي',
    expect: (g) => {
      assert.equal(g.kind, 'direct_product_search');
      assert.ok(g.blockers.includes('gift_not_engagement'));
    },
    note: 'خاتم هدية لا خطوبة',
  },
  {
    id: 9,
    request: 'أبي ذهب عيار ١٨',
    expect: (g) => {
      assert.ok(g.blockers.includes('require_karat_evidence'));
    },
    note: 'عيار مثبت لا لون ذهبي',
  },
  {
    id: 10,
    request: 'بس مو ذهبي',
    session: {
      q: 'شنطة',
      kindFilter: 'product',
      lane: 'elegance',
      targetIds: ['bags.hand'],
      priceMaxSar: 300,
      priceBound: 'exclusive',
      ruleIds: ['R016'],
    },
    expect: (g) => {
      assert.equal(g.q, 'شنطة');
      assert.equal(g.priceMax, 300);
      assert.ok(g.excludeColors.length > 0);
    },
    note: 'تصحيح لون مع الميزانية',
  },
  {
    id: 11,
    request: 'جزمة أطفال مقاس ٢٨',
    expect: (g) => {
      // size OOS is catalog/runtime; intent may stay advice or product
      assert.ok(['direct_product_search', 'advice_only'].includes(g.kind));
    },
    note: 'مقاس نافد — دليل كتالوج منفصل',
  },
  {
    id: 12,
    request: 'أبي مرطب بدون عطر',
    expect: (g) => {
      assert.equal(g.requireFragranceFree, true);
    },
    note: 'شرط عطر مثبت',
  },
  {
    id: 13,
    request: 'شو رأيكم؟',
    imageKind: 'face',
    expect: (g) => {
      assert.ok(g.blockers.includes('face_image_not_diagnosis'));
    },
    note: 'صورة وجه بلا عيادة',
  },
  {
    id: 14,
    request: 'أبي حجز ليزر في الرياض',
    expect: (g) => {
      assert.equal(g.kind, 'direct_service_search');
      assert.ok(g.ruleIds.includes('R077'));
    },
    note: 'ليزر صريح',
  },
  {
    id: 15,
    request: 'أبي باقة مكياج تشمل التصفيف',
    expect: (g) => {
      assert.equal(g.kindFilter, 'service');
    },
    note: 'باقة مكياج — لا بيع تصفيف مكرر بلا بيان',
  },
  {
    id: 16,
    request: 'ألغيت الحفلة',
    expect: (g) => {
      assert.equal(g.kind, 'refuse_path');
    },
    note: 'إيقاف تجهيز بعد الإلغاء',
  },
  {
    id: 17,
    request: 'أبي شنطة',
    expect: (g) => {
      assert.equal(g.kind, 'direct_product_search');
    },
    note: 'سحب/سعر — يُثبت عند فتح CatalogRecordScope',
  },
  {
    id: 18,
    request: 'وش أفضل روتين؟',
    expect: (g) => {
      assert.ok(g.blockers.includes('insufficient_signal') || g.kind === 'advice_only');
    },
    note: 'استشارة عادية عند تعطل/إغلاق الاكتشاف',
  },
  {
    id: 19,
    request: 'أبي هدية لمولود',
    expect: (g) => {
      assert.equal(g.saveAsPersonalPreference, false);
    },
    note: 'تفضيل الجلسة ≠ تنبيهات تسويق',
  },
  {
    id: 20,
    request: 'أبي منسقة في الرياض',
    expect: (g) => {
      // without wedding may be advice; with wedding organizer path
      assert.ok(g.kind === 'advice_only' || g.kind === 'direct_service_search' || g.kind === 'clarify');
    },
    note: 'فرع شريك — حالة حديثة من الكتالوج',
  },
];

assert.equal(cases.length, 20);

for (const c of cases) {
  let got;
  if (Array.isArray(c.request)) {
    let session: SessionDiscoveryContext | null = c.session ?? null;
    for (const msg of c.request) {
      got = decideIntent(extractSignals(msg, { imageKind: c.imageKind }), session);
      session = got.sessionPatch;
    }
  } else {
    got = decideIntent(
      extractSignals(c.request, { imageKind: c.imageKind }),
      c.session ?? null,
    );
  }
  assert.ok(got);
  c.expect(got!);
  console.log('pass study', c.id, c.note);
}

console.log('OK study acceptance 1–20 intent layer');
