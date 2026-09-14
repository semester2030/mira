# FK-1 — Red + Yellow + Wedding Target Architecture Trace

Architecture modeling only — **no assertion that a specific styling rule is true**.

1. **Facts:** blouse=red, skirt=yellow, occasion=wedding (from GI + occasionId)  
2. **Color relationship:** FKL may match curated color-contrast rule *if approved*; else Mode B candidate with `uncurated`  
3. **Occasion:** wedding context key applied  
4. **Rules:** curated first; else LLM draft  
5. **Subjectivity:** contrast observation LOW; calm-alternative HIGH  
6. **Preference:** if bold goal → preferenceConflict + alternatives  
7. **Candidates:** preserve bold / calm down / formalize via accessories  
8. **Claim Lock:** typically PASS_WITH_QUALIFICATION for LLM; PASS for curated  
9. **Advisor-safe facts:** locked candidates only  

Does not rely on Nest `isClashPair` (red–yellow absent) as knowledge.
