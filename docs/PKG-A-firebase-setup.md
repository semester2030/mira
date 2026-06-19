# PKG-A — Firebase بعد تغيير Bundle ID

تم تحديث معرّف التطبيق إلى **`app.mira.beauty`** في Xcode وGradle.

## مطلوب قبل TestFlight

1. [Firebase Console](https://console.firebase.google.com/) → مشروع `mirra-14b0e`
2. **Add app** → iOS → Bundle ID: `app.mira.beauty`
3. **Add app** → Android → Package: `app.mira.beauty`
4. نزّل الملفات الجديدة واستبدل:
   - `ios/Runner/GoogleService-Info.plist`
   - `android/app/google-services.json`
5. شغّل من جذر المشروع:
   ```bash
   dart pub global activate flutterfire_cli
   flutterfire configure
   ```
6. تحقق: `lib/firebase_options.dart` يحتوي `iosBundleId: 'app.mira.beauty'`

## Apple Signing

```bash
cp ios/Flutter/Signing.xcconfig.example ios/Flutter/Signing.xcconfig.local
# عدّل DEVELOPMENT_TEAM = YOUR_TEAM_ID
```

## Push Notifications (لاحقاً)

معطّلة مؤقتاً لتجنّب تعارض Provisioning Profile أثناء التطوير.

**لإعادة التفعيل:**
1. Xcode → Runner → Signing & Capabilities → **+ Push Notifications**
2. في `ios/Runner/Runner.entitlements` أضف:
   ```xml
   <key>aps-environment</key>
   <string>development</string>
   ```
   (استخدم `production` لـ TestFlight/App Store)
3. فعّل Push على App ID `app.mira.beauty` في Apple Developer
4. أزل التعليق عن `firebase_messaging` في `pubspec.yaml` ثم `flutter pub get && cd ios && pod install`
5. إن أضفت Push في Xcode يدوياً سابقاً، احذف Capability ثم أعد إضافتها بعد توقيع PLA

## App Store Connect

- Privacy Policy URL: `https://mira.app/docs/privacy-policy.html` (أو `--dart-define=MIRA_PUBLIC_SITE_URL=...`)
- Support URL: `https://mira.app/docs/support.html`
