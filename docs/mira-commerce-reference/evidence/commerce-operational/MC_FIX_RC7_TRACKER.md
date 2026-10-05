# MC-FIX RC7 Tracker

source_commit_code=affa4831d2898c9cb021d0d746d50fa964077c2c
docs_commit=(pending)
base_rc6_commit=b60274435d531721986c396d5b5ede2f1d931490
base_rc6_sha256=c53e01faffc0f0bf03d46541b1c3720d071648f3729510951b2bb85f6ed8586f
zip=MIRA_COMMERCE_MC_FIX_RC7.zip
zip_bytes=50320044
zip_sha256=720caa1891f10cb44decab660f9b6dc9333396ebcfd595813f863f25f3ebf402
deploy_mira_api=dep-db1pdv0jo6nc73arq120 LIVE affa483
deploy_partners=dep-db1pdv0jo6nc73arq1s0 LIVE affa483
deploy_admin=pending_trigger (was b602744)

| id | fix | test | env | result | evidence | remaining |
|---|---|---|---|---|---|---|
| RC7-01 | clear-options button + confirm/cancel/pending | portal probe + rc7 options | local UI | PASS | mc-fix-rc7/browser-ui-* | live draft→admin NOT_RUN |
| RC7-02 | presetGroups optional; Flutter path packer | options RC2–RC7; flutter marketplace | local + unpack | PASS | portal-options; unpack-*; PACKAGING_RC6_PATH_BUG.txt | — |
| RC7-03 | holder PID + advisory hashtext waits | npm run test:commerce | local Postgres + unpack | PASS | test-commerce.log; unpack-test-commerce.log | — |
| RC7-04 | live/device journeys | — | live/device | NOT_RUN | LIVE_JOURNEY.txt | partner/admin test accounts; device |
| RC7-05 | site cards + links | validate_package | local site | PASS | discover-phases.json; site-validate.txt | independent review |
| RC7-06 | seal zip | unpack verify + retests | unpack cwd | PASS | PACKAGE_VERIFY.txt; VERIFICATION.txt | independent review |

Preserved: category_incompatible; lockPartnerScheduleScope order.
Deferred by owner: durable storage; real view counts.
Phase approval: not self-approved (2/5 only).
