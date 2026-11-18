# سيناريوهات تحقق الجهاز — 1713

التطبيق المثبّت: **2026111713** · السجل جاهز على الجهاز · اسحب بعد كل مجموعة أو في النهاية.

```bash
bash evidence/1713/raw/pull_device_discover_log.sh \
  00008110-00191986268BA01E \
  evidence/1713/raw/mira_discover_device_after_scenarios.log
```

اربط كل سحبة بـ: `session` + `transition` + `mediaId` + `playerId` من السجل.
`firstFrameMs` من `MIRA_DISCOVER_FF` ≠ ظهور على تسجيل الشاشة — وثّق مصدر القياس صراحة.

| # | السيناريو | نتيجة المستخدم | مفاتيح السجل | حالة |
|---|---|---|---|---|
| 1 | فتح اكتشفي + مقطع جديد | | IDENTITY, CACHE, FF | عيّنة جزئية عند الإطلاق |
| 2 | ثانيتان ثم التالي × عدة | | SWIPE, AUDIO cut/unmute, FF, LOCK | OPEN |
| 3 | رجوع بعد المرور على ~20 | | CACHE source=disk/partial/network, FF | OPEN |
| 4 | فيديو→صورة→فيديو + سحب سريع/عكسي | | SWIPE, AUDIO, FF | OPEN |
| 5 | مغادرة اكتشفي والرجوع | | leave_section / IDENTITY | OPEN |
| 6 | إغلاق التطبيق وتشغيله ثم مقطع محفوظ | | CACHE disk, FF | OPEN |

إذا بقي تأخير: اختر انتقالًا واحدًا بطيئًا، انسخ أسطره من السجل، حدّد أين استُهلك الوقت (LOCK / CACHE.elapsedMs / init→play / firstFrameMs)، أصلح السبب المثبت فقط، أعد السيناريو نفسه.
