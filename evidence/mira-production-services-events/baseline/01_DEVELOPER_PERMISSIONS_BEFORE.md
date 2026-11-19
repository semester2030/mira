# صلاحيات المطوّر — خط الأساس (قبل النشر المرشّح)

| الحقل | القيمة (منقّحة) |
|---|---|
| مصدر | mira-db `dpg-d85ng27avr4c73d3r7sg-a` |
| partner.type | `developer` |
| partner_users | 1 |
| email | `faz…` (مختصر) |
| can_sell_products (عمود) | false — **التجاوز الفعلي عبر type=developer في partner-capabilities** |
| products | 92 |
| services | 7 |
| catalog ads (advertiser/publisher) | 0 على هذا الاستعلام |
| activities_meta | null |
| مسار التفويض | `PartnerTokenGuard` + `assertAuthorizedWrite` يتجاوز `paGrant` للمطوّر |

عمليات متوقعة تبقى متاحة: إنشاء/تعديل منتجات وخدمات، كتالوج كامل في dashboard، نشر بحسب مسار الاعتماد الحالي.  
لا يُحوَّل إلى شريك عادي ولا يُطلب إعادة تسجيل.
