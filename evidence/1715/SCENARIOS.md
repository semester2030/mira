# سيناريوهات جهاز — 1715

بعد فتح اكتشفي، أثبت من السجل: `MIRA_BUILD_IDENTITY build=2026111715`.

```bash
bash evidence/1713/raw/pull_device_discover_log.sh \
  00008110-00191986268BA01E \
  evidence/1715/raw/mira_discover_device_after_fix.log
```

| # | السيناريو | مقارنة |
|---|---|---|
| A | كاش جزئي / مقطع جديد بطيء (شبه T41) | initDone و firstFrameMs مقابل 4009؛ وجود prefix_kick blocking=0؛ cacheBytesAtOpen |
| B | رجوع لمكتمل بعد ≥20 (شبه T35) | firstFrameMs مقابل 607؛ إن وُجد seek: seek_nudge_done ثم تقدم بعد posAfterSeek |
| C | تسجيل شاشة لـA/B | لا تُساوَى firstFrameMs بالظهور دون ذكر المصدر |
| D | صوت | unmute_req/audio_armed للمشغّل الحالي |
