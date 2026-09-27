# Mapping / isolation

| Concern | Perfect provider | Presentation |
|---|---|---|
| التصبغات | hd_age_spot | luminanceGate pigment |
| المسام | hd_pore | luminanceGate pores |
| التجاعيد | hd_wrinkle | luminanceGate wrinkles |
| الدهون | hd_oiliness | luminanceGate oiliness |
| الحبوب | hd_acne | luminanceGate acne |
| الاحمرار | hd_redness | luminanceGate redness |
| الملمس | hd_texture | luminanceGate texture |
| الترطيب | hd_moisture | luminanceGate hydration |

Carousel filter: `session.lookup(...).bytes` non-empty only.

Apple matte: MethodChannel `mira/apple_person_matting` / `generatePersonMatte` only from Face Explorer image load (and internal POC). Not at bootstrap.
