# جمالك — قبول المرحلة A

| Journey | Expected | Status |
| --- | --- | --- |
| Taxonomy load `lane=beauty` | `beauty.salons` ≠ `beauty.clinics`; 47 write leaves | PASS (`beauty-a-acceptance.schema-tests.ts`) |
| Cut vs color | Distinct id, labelAr, imageKey, icon URL/version | PASS |
| Write leaf icons | Every enabled leaf resolves `imageKey`; no parent imageKey reuse | PASS |
| Clinic hair eval | `beauty.clinic.derm.hair_eval` → `service.clinic_consult` (not skin session fields) | PASS |
| Laser under salons | Not a child of `beauty.salons` | PASS |
| Home-visit filter | `placeModes=['home']` excludes clinic / laser / `beauty.clinic.*` | PASS |
| Portal orbs | Per-leaf orb from taxonomy `icon`/`imageKey`; not parent category art | Wired in `e2b-service-shell.js` |
| Portal clinic cats | `laser` / `teeth` allowed in `SERVICE_CATEGORIES` + clinic category list | Wired |
| Flutter rail | `DiscoverLane.beauty.usesTaxonomyRail`; home chip sets `placeModes: home` + salon | Wired |
| Draft reopen | Leaf id stored in `subcategory`; sticky `profileId` from leaf | Wired in `selectSub` taxonomyLeaf path |

No false closure: passing schema tests does **not** claim Phase B (specialist calendar / multi-branch grants).
