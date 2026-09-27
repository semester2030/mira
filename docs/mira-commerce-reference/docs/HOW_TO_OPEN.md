# فتح الموقع المرجعي

الإصدار: RC3 — تصحيح الموقع بعد المراجعة.
الحالة: بانتظار إعادة المراجعة. GATE-00 غير مغلق.

```bash
python3 -m http.server 8765
```

من حزمة مفكوكة، شغّل الأمر داخل مجلد الموقع ثم افتح http://127.0.0.1:8765/

فحص السلامة: `python3 scripts/validate_package.py --root .`
فحص الحداثة، وهو مستقل: `python3 scripts/verify_evidence_freshness.py --repo /path/to/mira`
