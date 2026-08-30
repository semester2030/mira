import '../versioning/results_experience_versions.dart';

class PublicLanguageViolation {
  const PublicLanguageViolation(this.term, this.field);

  final String term;
  final String field;
}

/// Law #36 enforcement — reject/flag internal terminology in public copy.
abstract final class PublicLanguagePolicy {
  static const String version = ResultsExperienceVersions.publicLanguagePolicy;

  /// Forbidden substrings (case-insensitive) in public explanatory text.
  static const List<String> forbiddenTerms = [
    'provider_measured',
    'locally_calculated',
    'raw=',
    'mapped from provider',
    'canonical',
    'trace',
    'runtime',
    'svi version',
    'face-report version',
    'projection',
    'trends',
    'actives',
    'mce',
    'provider id',
    'evidence graph',
    'implementation',
    'formulaversion',
    'intelligenceversion',
  ];

  /// Standalone tokens that should not appear as internal jargon in Arabic UI.
  /// Product/ingredient commercial names are allowed elsewhere.
  static const List<String> forbiddenLoose = [
    'provider',
    'concern',
  ];

  static List<PublicLanguageViolation> validate(
    String text, {
    required String field,
    bool allowLooseProviderWord = false,
  }) {
    final violations = <PublicLanguageViolation>[];
    final lower = text.toLowerCase();
    for (final term in forbiddenTerms) {
      if (lower.contains(term)) {
        violations.add(PublicLanguageViolation(term, field));
      }
    }
    if (!allowLooseProviderWord) {
      for (final term in forbiddenLoose) {
        // word-ish check
        final re = RegExp('\\b${RegExp.escape(term)}\\b', caseSensitive: false);
        if (re.hasMatch(text)) {
          violations.add(PublicLanguageViolation(term, field));
        }
      }
    }
    return violations;
  }

  static bool isPublicSafe(String text, {required String field}) =>
      validate(text, field: field).isEmpty;

  /// Sanitize by replacing known leaks with public-safe alternatives.
  static String sanitize(String text) {
    var out = text;
    const replacements = <String, String>{
      'provider_measured': 'من التحليل',
      'locally_calculated': 'محسوب من التحليل',
      'Trends': 'مقارنة',
      'trends': 'مقارنة',
      'MCE': 'مستشار ميرا',
      'mce': 'مستشار ميرا',
      'projection': 'تقدير',
      'Projection': 'تقدير',
    };
    replacements.forEach((k, v) {
      out = out.replaceAll(k, v);
    });
    return out;
  }
}
