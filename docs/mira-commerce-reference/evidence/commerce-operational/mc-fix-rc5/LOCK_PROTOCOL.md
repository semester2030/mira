# RC5 schedule lock protocol — merchant edits vs bookings

Scope: partner-local sharing graph only. Same resource *name* across partners does not share locks.

Lock acquisition order (stable, deadlock-safe):
1. Expand seed service/resource IDs via `expandScheduleScope` over that partner’s services.
2. Build sorted advisory keys via `scheduleLockKeys` (`commerce-booking-service:<id>`, `commerce-booking-resource:<partnerId>:<resourceId>`).
3. `acquireScheduleLocks` — `pg_advisory_xact_lock(hashtext(key))` in sorted key order.
4. `lockServiceRows` — `SELECT … FOR UPDATE` on affected service ids (sorted).
5. Re-read schedule/capacity after locks; never write a full availability table from a pre-lock snapshot.

Why sufficient: any booking or merchant mutation that can change capacity or booking eligibility for a shared resource joins the same expanded set, so concurrent writers serialize before re-read/write. Partners never collide on name-only keys.

| المسار | الدالة | الحماية | الاختبار |
| --- | --- | --- | --- |
| إنشاء حجز | `CommerceService.createBooking` | expand + advisory + service FOR UPDATE؛ رفض إن غير قابلة للحجز بعد القفل | concurrency E1–E4, E5 booking wait |
| تعديل خدمة (سعة/جدولة/مورد/تعطيل) | `PartnersPortalService.updateService` | نفس البروتوكول + إعادة قراءة قبل unify | E2, E3, E4؛ lost-update |
| إنشاء خدمة مع unify | `PartnersPortalService.createService` | معاملة ذرية + أقفال النطاق قبل unify | create-service-atomic 1–6 |
| سحب خدمة (تاجر) | `PartnersPortalService.deleteService` → withdrawn | schedule locks قبل تغيير الحالة | E6 |
| سحب/قرار محتوى (إدارة) | `CatalogContentService` withdraw path | schedule locks عند تغيير صلاحية الحجز | E5 |
| حجزان على مورد مشترك بسعة 1 | `createBooking` ×2 | قفل مورد شريك | concurrency F |
| نفس اسم مورد لجهتين | حجوزات مستقلة | مفاتيح تتضمن `partnerId` | concurrency I |

لا يُعتبر حجز قفل يدوي داخل الاختبار بديلًا عن استدعاء `createBooking` / `deleteService` / `updateService` الإنتاجية.
