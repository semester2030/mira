# PHASE 8A — Personalization Audit

## Classification guide
1. Evidence-derived — from frozen metrics/findings  
2. Profile-derived — skin type / preferences  
3. Context-derived — time of day, season (if available)  
4. General educational  
5. Unsupported / unclear  

## Common phrases
| Phrase | Likely class today | Rule |
|--------|-------------------|------|
| Drink 8 glasses / sleep 8h | 4 General | Label «نصيحة عامة» or hide from AI results |
| Use moisturizer | 1 if moisture severity≠none else 4 | Bind to metric evidence id |
| Use sunscreen | Usually 4 unless UV context | Label general |
| Gentle cleanser | Usually 4 / routine template | Routine module |
| Priority finding titles | 1 | Keep ≤3 |

## Proposed public labels
- بناءً على تحليلك  
- بناءً على نوع بشرتك  
- نصيحة عامة  
- تقدير يحتاج متابعة  
- ثقة محدودة  

General advice MUST NOT be framed as personalized AI output.
