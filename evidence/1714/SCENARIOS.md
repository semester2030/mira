# سيناريوهات إعادة التحقق — 1714

ثبّت `2026111714` دون حذف بيانات التطبيق. اسحب السجل بعد التجربة:

```bash
bash evidence/1713/raw/pull_device_discover_log.sh \
  00008110-00191986268BA01E \
  evidence/1714/raw/mira_discover_device_after_fix.log
```

| # | السيناريو | هدف المقارنة | حالة |
|---|---|---|---|
| A | مقطع بكاش جزئي (~1MiB) مشابه لـT41 | firstFrameMs و initDone مقابل 4009؛ وجود `prefix_seed_*`؛ `elapsedMs` حقيقي | OPEN |
| B | رجوع لأول مقطع بعد ≥20 وسيطًا (ملف مكتمل) | firstFrameMs مقابل 607؛ `seekNudgeKind=2` إن وُجد | OPEN |
| C | تسجيل شاشة لـA وB | لا تُساوَى firstFrameMs بظهور الشاشة دون الإشارة للمصدر | OPEN |
| D | صوت على مقطع بطيء سابقًا | unmute_req / audio_armed أو unmute_skipped صريح | OPEN |
