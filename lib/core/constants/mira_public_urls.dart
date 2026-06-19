/// Public URLs for App Store Connect metadata and in-app links.
abstract final class MiraPublicUrls {
  MiraPublicUrls._();

  /// Host docs on GitHub Pages, Render static site, or mira.app — update before release.
  static const siteBase = String.fromEnvironment(
    'MIRA_PUBLIC_SITE_URL',
    defaultValue: 'https://mira.app',
  );

  static const privacyPolicy = '$siteBase/docs/privacy-policy.html';
  static const support = '$siteBase/docs/support.html';
  static const supportEmail = 'support@mira.app';
  static const privacyEmail = 'privacy@mira.app';
}
