/// Public URLs for App Store Connect metadata and in-app links.
abstract final class MiraPublicUrls {
  MiraPublicUrls._();

  /// Public web base for share / privacy links.
  /// mira.app currently 301s off-product; default to the hosted Mira static site.
  static const siteBase = String.fromEnvironment(
    'MIRA_PUBLIC_SITE_URL',
    defaultValue: 'https://mira-website.onrender.com',
  );

  static const privacyPolicy = '$siteBase/docs/privacy-policy.html';
  static const support = '$siteBase/docs/support.html';
  static const supportEmail = 'support@mira.app';
  static const privacyEmail = 'privacy@mira.app';
}
