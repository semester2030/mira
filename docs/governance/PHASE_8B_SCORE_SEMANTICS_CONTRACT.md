# PHASE 8B — Score Semantics Contract

Categories: WELLNESS_SCORE, CONCERN_SEVERITY, CONFIDENCE_SCORE, PROGRESS_DELTA, PROJECTION, PRODUCT_MATCH, ESTIMATED_SKIN_AGE, NON_PUBLIC_TECHNICAL_SCORE.

Concern severity: **higher worse**, colorRole=`severity`.  
Wellness: higher better, colorRole=`wellness`.  
Confidence: separate colorRole=`confidence`.  
Projection: labeled تقدير — never measurement.

Conversion helper: wellness UI → severity = `100 - wellness` for public presentation only.
