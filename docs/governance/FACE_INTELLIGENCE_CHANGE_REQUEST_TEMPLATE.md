# Face Intelligence Change Request Template

**Copy this file for each proposed change.**  
File as: `docs/governance/crs/FI-CR-YYYYMMDD-short-title.md`

---

## Metadata

| Field | Value |
|-------|--------|
| CR ID | FI-CR-____ |
| Title | |
| Author | |
| Date | |
| Target release | (e.g. 1.1.0 / 2.0.0) |
| Change class | PATCH / MINOR / MAJOR |

## 1. Reason

(Why is this needed?)

## 2. Business value

(User / product outcome)

## 3. Technical impact

(Code areas, performance, providers)

## 4. Affected contracts

- [ ] face_intelligence_contract  
- [ ] face_measurement_contract  
- [ ] face_findings_contract  
- [ ] face_recommendation_contract  
- [ ] face_report_contract  
- [ ] face_validation_contract  
- [ ] None  

Details:

## 5. Affected DTOs / fields

## 6. Affected reports / goldens

## 7. Affected tests

List suites that must stay green / that will be updated:

## 8. Migration plan

(Clients, stored `resultJson`, Flutter)

## 9. Rollback plan

## 10. Version bumps

| Identifier | From | To |
|------------|------|-----|
| Release | 1.0.0 | |
| Formula / contract ids | | |

## 11. Approvals

| Role | Name | Date | Decision |
|------|------|------|----------|
| Face Intel owner | | | |
| Eng lead | | | |
| Product (MAJOR) | | | |
| Architecture (MAJOR) | | | |

## 12. Checklist

- [ ] Change Policy read  
- [ ] Protected components reviewed  
- [ ] Compatibility matrix updated if needed  
- [ ] Manifest JSON/MD updated  
- [ ] No attractiveness / FaceHealthMap merge  
- [ ] Runtime states remain explicit  
- [ ] Single production `runFaceReportPipeline` preserved  
