# PHASE 8A — Skin Map Audit

## Evidence
- `ReportFaceMapSpec`: subtitle «المناطق الشائعة المرتبطة بالمؤشر»; disclaimer admits difference from actual distribution.  
- `local_face_map_builder.dart`: severity text from score thresholds; narrative says educational guidance not positional diagnosis.  
- Highlights are **template region lists per concern id**, intensity tiers from score — not segmentation masks.  
- Painter markers use severity radius (`face_diagram_painter.dart`).

## Mode determination
**Approved mode for current implementation: B (User-image illustrative overlay) leaning C (educational)** — NOT Mode A (real evidence-derived heatmap).

## Rules (locked)
1. UI must show mode badge: «خريطة إرشادية — ليست قياساً موضعياً».  
2. Never present as measured localization.  
3. Color intensity = presentation of score tier, not pixel evidence.  
4. Interaction allowed: select concern → show associated common regions + link to metric explain.  
5. Upgrade to Mode A only with frozen segmentation evidence contract (future; out of 8A scope).
