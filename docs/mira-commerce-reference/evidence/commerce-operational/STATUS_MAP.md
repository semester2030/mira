# خريطة حالات الطلب والحجز والتحصيل

## طلب منتج (fulfillmentStatus)
| حالة | معنى | انتقالات مسموحة | من |
| --- | --- | --- | --- |
| new | طلب جديد | accepted, rejected, cancelled | شريك/إدارة؛ العميل يلغي فقط |
| accepted | مقبول | preparing, rejected, cancelled | شريك/إدارة |
| preparing | قيد التجهيز | out_for_delivery, cancelled | شريك/إدارة |
| out_for_delivery | خرج للتوصيل | delivered, failed_delivery | شريك/إدارة |
| delivered | تم التسليم | — | نهائي |
| rejected | مرفوض | — | نهائي (يحرر المخزون مرة) |
| cancelled | ملغى | — | نهائي (يحرر المخزون مرة) |
| failed_delivery | تعذر التسليم | — | نهائي |

## التوصيل (deliveryStatus) منفصل عن التنفيذ
pending | out_for_delivery | delivered | failed | none

## التحصيل (paymentCollectionStatus) — COD
uncollected | collected | waived  
التحصيل ليس تلقائيًا عند التسليم. التسجيل بفاعل وتوقيت.

## حجز خدمة (status)
| حالة | معنى |
| --- | --- |
| requested | طلب موعد بانتظار قبول الجهة — ليس حجزًا مؤكدًا |
| confirmed | حجز مؤكد بعد قبول التوفر |
| completed | اكتملت الخدمة |
| cancelled | ملغى (يحرر السعة) |
| rejected | مرفوض (يحرر السعة) |

دفع الخدمات: `pay_at_venue` — ليس «الدفع عند الاستلام» الخاص بالمنتجات.

## المشاهدات
ما زالت مؤجلة (`viewCountPolicy` في discover-phases.json). العد غير مفعّل. ليس اعتمادًا للعتبات المقترحة.
