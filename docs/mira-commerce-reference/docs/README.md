# المتاجر الإلكترونية في ميرا — RC3

الحالة: بانتظار إعادة المراجعة. هذا موقع دراسة، لا يغيّر تطبيق ميرا ولا ينشره.

## التشغيل

```bash
cd docs/mira-commerce-reference
python3 -m http.server 8765
```

افتح http://127.0.0.1:8765/ أو افتح `index.html` مباشرة لأن البيانات مضمّنة في `js/data.generated.js`.

## فحص الحزمة المستقل

يعمل بعد فك ZIP في مجلد خارج المستودع. لا يحتاج ميرا ولا دار كار.

```bash
python3 scripts/validate_package.py --root .
```

يغطي: MANIFEST، البيانات وترابط المعرّفات، ملفات الإثبات المحلية، الصور المشار إليها، تطابق JSON مع `js/data.generated.js`، ومعرّفات HTML التي يولّدها العرض. لا يكتب داخل الحزمة.

`python3 scripts/validate_study.py` يشغّل الفحص نفسه ويذكّر أن الحداثة أمر منفصل.

## فحص حداثة الأدلة

```bash
python3 scripts/verify_evidence_freshness.py --repo /path/to/mira
```

يقارن أدلة `fact` الثمانية عشر بملفات المستودع الحالي. إذا غاب المسار فالحالة `BLOCKED` وخروج الأمر 2. هذا ليس PASS، ولا يُفشل فحص الحزمة.

## نسخة اختبار اكتشفي

من جذر مشروع ميرا، دون تغيير الافتراضي:

```bash
flutter run --dart-define=MIRA_MARKETPLACE_ENABLED=true
```

أو إعداد التشغيل «MIRA Discover Test». هذا ليس تفعيل إنتاج.

## توليد البيانات

```bash
python3 scripts/generate_data_js.py
python3 scripts/write_manifest.py
```

لا تُنشئ السجل إلا بعد استقرار الملفات. الفحص التالي يجب ألا يغيّر الحزمة.
