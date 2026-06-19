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

## App Store Connect

- Privacy Policy URL: `https://mira.app/docs/privacy-policy.html` (أو `--dart-define=MIRA_PUBLIC_SITE_URL=...`)
- Support URL: `https://mira.app/docs/support.html`
