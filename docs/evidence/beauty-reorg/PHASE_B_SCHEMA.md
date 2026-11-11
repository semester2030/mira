# جمالك — مخطط بيانات المرحلة B (تصميم فقط)

Phase A fixes taxonomy binding. Phase B adds establishment / team / place grants and a **single specialist calendar**. Do not implement booking engine here — only the model.

## Account kinds (keep legacy ids where possible)

| Kind | Meaning | Write authority |
| --- | --- | --- |
| `salon` | صالون / مشغل | Approved activities only |
| `studio` | استوديو متخصص (new or alias of independent+venue) | Approved activities |
| `independent` | مختصّة باسمها | Approved activities |
| `spa` | سبا غير طبي (new or upgrade of `care`) | Non-medical activities |
| `clinic` | منشأة صحية | Medical activities (`medicalOnly`) |

Writing a leaf requires **approved activity grant**, not merely `partnerType === salon`.

## Core entities

```text
Partner
  └── PartnerBranch (existing) — venue address, geo, hours shell
  └── BeautySpecialist (new)
        id, partnerId, displayNameAr, active
  └── SpecialistBranchLink (new)
        specialistId × branchId × activityIds[] × placeModes[]
  └── PlaceGrant (new or extend PaGrant)
        partnerId × activityId (taxonomy leaf or mid) × placeMode
        status: pending|approved|expired
        document refs (Phase C)
  └── SpecialistCalendar (new) — ONE calendar per specialist
        blocks: { start, end, placeMode, branchId?, coverageCityIds? }
```

### Invariants

1. A specialist cannot be booked at a branch and at a client home for overlapping intervals (single calendar).
2. `placeMode` on a published service must be ⊆ partner’s approved `PlaceGrant` for that activity.
3. Medical leaves (`medicalOnly` / `clinic_only`) never receive `client_home` / `provider_home` grants.
4. Multi-branch makeup: one service definition; visibility = branches in `SpecialistBranchLink` that include the makeup activity.
5. Home coverage: `coverageCityIds` (or neighborhood ids) on the home grant / calendar block — discover filters by city coverage, not HQ city alone (already partially true for `placeMode=home`).

## Place modes (server enum)

`branch` | `client_home` | `provider_home` | `event_venue` | `clinic_only`

Map legacy service profile `placeMode=home` → `client_home` on read until writers migrate.

## Closure scenario (implement in B+C)

1. Salon with two branches; makeup activity approved on both.
2. One specialist linked to both branches + home grant for three neighborhoods.
3. Publish «مكياج عروس» once → appears for both branches and home within those neighborhoods only.
4. Double-book attempt (branch slot vs home slot same specialist) → reject.
5. Draft reopen preserves name / imageKey / taxonomy leaf / place modes.

## Prisma sketch (additive)

```prisma
model BeautySpecialist {
  id            String   @id @default(cuid())
  partnerId     String
  displayNameAr String
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  links         SpecialistBranchLink[]
  calendarBlocks SpecialistCalendarBlock[]
}

model SpecialistBranchLink {
  id           String   @id @default(cuid())
  specialistId String
  branchId     String
  activityIds  String[] // taxonomy ids
  placeModes   String[]
}

model SpecialistCalendarBlock {
  id              String   @id @default(cuid())
  specialistId    String
  startAt         DateTime
  endAt           DateTime
  placeMode       String
  branchId        String?
  coverageCityIds String[]
  bookingId       String?
}
```

Extend `PaGrant` (or parallel `PlaceGrant`) with `placeMode` + `activityId` rather than overloading partner type.

## Out of scope until A stays green

- Admin compliance document gates (Phase C)
- Auto-disable home when permit expires while keeping branch services
- Full Flutter booking UI for multi-place specialists
