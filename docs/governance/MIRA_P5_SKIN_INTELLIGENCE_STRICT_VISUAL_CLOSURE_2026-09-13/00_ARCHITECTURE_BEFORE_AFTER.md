# Architecture — Before / After

## BEFORE (owner visually rejected)
- Face Explorer present; Perfect HD masks real
- Mask presentation too subtle (opacity ~0.44)
- Ordinary chip selector + «إخفاء المزيد»
- Weak score/callout presence
- Felt like cleaned report

## AFTER (presentation-only redesign)
- Same owners: PerfectMaskSession → PerfectMaskOverlay → ResultsSkinMapPanel
- Mask clarity: opacity 0.58 + soft presence pass (identical Perfect alpha; no dilation)
- Premium metric selector (icon + label cards) + «المزيد» bottom sheet
- Active metric hero (title + score + status)
- Provider-backed subregion callouts only
- Progressive «التفاصيل» for pores/wrinkles
- Hold-to-compare; hint once
- Subtle metric atmosphere tint
- Report content separated under «ملخص التحليل»

## UNCHANGED (sacred)
- Perfect API / request / parser / models / mask geometry / alignment
- Backend / capture / Face Mesh / scores / privacy
