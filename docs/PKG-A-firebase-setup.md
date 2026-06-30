# PKG-A — Firebase + Bundle ID `app.mira.beauty`

## ✅ تم في المشروع (2026-06-27)

| المنصة | Bundle / Package | Firebase App ID |
|--------|------------------|-----------------|
| iOS | `app.mira.beauty` | `1:399849748934:ios:25ac117e432b31f497dac7` |
| Android | `app.mira.beauty` | `1:399849748934:android:1d531f1bf71ed3f097dac7` |

الملفات المحدّثة:
- `ios/Runner/GoogleService-Info.plist`
- `android/app/google-services.json`
- `lib/firebase_options.dart`
- `ios/Runner/Info.plist` → `REVERSED_CLIENT_ID` الجديد
- `firebase.json`

**التطبيق القديم** `com.example.mirra` (`…07f1a376…`) — لا تستخدمه. يمكن حذفه من Firebase Console لاحقاً.

---

## إعادة التكوين (إذا لزم)

```bash
dart pub global activate flutterfire_cli
flutterfire configure \
  --project=mirra-14b0e \
  --platforms=ios,android \
  --ios-bundle-id=app.mira.beauty \
  --android-package-name=app.mira.beauty \
  --yes
```

ثم انسخ `REVERSED_CLIENT_ID` من `GoogleService-Info.plist` إلى `ios/Runner/Info.plist` → `CFBundleURLSchemes`.

---

## Phone Auth — اختبار OTP

1. Authentication → Sign-in method → **Phone** → Enabled
2. **Phone numbers for testing** (موصى به للتطوير — بدون SMS حقيقي):
   - `+966553411556` → `123456` (مثال)
3. SMS region: **Allow → Saudi Arabia (SA)**
4. إن **لم يصل SMS** رغم ظهور شاشة «رمز التحقق»:
   - انتظري 60 ثانية
   - أكملي **نافذة reCAPTCHA** إن ظهرت (Firebase بدون Push)
   - Project settings → Cloud Messaging → **APNs Authentication Key** (.p8) — اختياري لتحسين Silent Verify
   - Firebase Console → Authentication → Usage — تحققي من عدم تجاوز الحصة
5. `AppDelegate.swift` يستدعي `FirebaseApp.configure()` قبل Phone Auth

---

## Apple Signing (Xcode)

### الأخطاء في الصورة

| الخطأ | السبب | الحل |
|-------|--------|------|
| **No Account for Team "P9C9QSDZY9"** | Apple ID غير مسجّل في Xcode | Xcode → **Settings…** (⌘,) → **Accounts** → **+** → Apple ID → سجّل دخول حساب **TARIQ ALDALBAHI** |
| **No profiles for 'app.mira.beauty'** | يتبع خطأ الحساب أعلاه | بعد تسجيل الدخول: Signing & Capabilities → **Try Again** أو أزل ✓ ثم أعد ✓ **Automatically manage signing** |
| **PhaseScriptExecution failed** | غالباً نتيجة فشل التوقيع أو امتلاء القرص | تأكد من ≥5 GB فارغ، ثم `flutter clean` و `pod install` |

### خطوات Xcode (بالترتيب)

1. **Xcode → Settings → Accounts** → أضف Apple ID (نفس حساب Developer Team **P9C9QSDZY9**)
2. [developer.apple.com](https://developer.apple.com) → سجّل **Program License Agreement** إن ظهرت
3. **Runner** → **Signing & Capabilities**:
   - ✓ Automatically manage signing
   - Team: **TARIQ ALDALBAHI**
   - Bundle Identifier: **`app.mira.beauty`**
4. **أزل Background Modes → Remote notifications** (Push معطّل مؤقتاً — لا تحتاجه لـ OTP/reCAPTCHA)
5. **Product → Clean Build Folder** (⇧⌘K) ثم Build

### ملف الفريق المحلي (اختياري)

```bash
cp ios/Flutter/Signing.xcconfig.example ios/Flutter/Signing.xcconfig.local
# DEVELOPMENT_TEAM = P9C9QSDZY9
```

`Signing.xcconfig.local` في `.gitignore` — لا يُرفع إلى Git.

### بناء من Terminal (موصى به)

```bash
cd /Users/fayez/Desktop/mira
flutter clean && flutter pub get
cd ios && pod install && cd ..
flutter run -d YOUR_DEVICE_ID
```

**لا تبني من مجلد `ios/` فقط** — استخدم `flutter run` من جذر المشروع.

---

## Push Notifications (لاحقاً)

معطّلة مؤقتاً. لإعادة التفعيل:
1. Xcode → Push Notifications capability
2. `Runner.entitlements` → `aps-environment`
3. Firebase → APNs key
4. `firebase_messaging` في `pubspec.yaml`

---

## App Store Connect

- Privacy: `https://mira.app/docs/privacy-policy.html`
- Support: `https://mira.app/docs/support.html`

---

## تحقق بعد البناء

```bash
flutter clean && cd ios && pod install && cd ..
flutter run -d YOUR_DEVICE
```

في Firebase Console → Project settings → Your apps: تأكد أن iOS يظهر **`app.mira.beauty`** وليس `com.example.mirra`.
