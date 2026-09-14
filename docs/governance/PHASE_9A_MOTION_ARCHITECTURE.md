# Phase 9A — Motion Architecture

**Program:** Mira Face Analysis Experience Transformation  
**Phase:** 9A — READ ONLY Discovery + Architecture Lock  
**Date:** 2026-08-11  


| Need | Tech | Notes |
|------|------|-------|
| Alignment / contour | CustomPainter + existing mesh painters | LIVE stack |
| Scan line | CustomPainter (unused `ScanningLinePainter` exists) | Prefer Flutter; no Rive/Lottie dep today |
| Result pulses / sheets | Implicit animations / Tween | LIVE patterns |
| Shaders | Optional later | Performance risk mid-range |
| Rive/Lottie | NOT_FOUND in pubspec | Would add dependency — decision gate |

Reduce Motion: replace sweep with fades.
