import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/domain/catalog_service_template.dart';

void main() {
  group('CatalogServiceProfile.fromServiceProfileJson', () {
    test('null and legacy absence stay empty', () {
      expect(CatalogServiceProfile.fromServiceProfileJson(null).isEmpty, isTrue);
      expect(CatalogServiceProfile.fromServiceProfileJson(<String, dynamic>{}).isEmpty, isTrue);
    });

    test('parses approved profile with Arabic-displayable answers', () {
      final profile = CatalogServiceProfile.fromServiceProfileJson({
        'templateId': 'salon_hair_cut',
        'templateVersion': 1,
        'priceMode': 'from',
        'answers': {
          'session_kind': 'single',
          'includes': ['wash', 'cut'],
          'needs_assessment': true,
        },
      });
      expect(profile.templateId, 'salon_hair_cut');
      expect(profile.priceMode, CatalogServicePriceMode.from);
      expect(profile.answer('session_kind').asString(), 'single');
      expect(profile.answer('includes').asStringList(), ['wash', 'cut']);
      expect(profile.answer('needs_assessment').asBool(), isTrue);
      final template = CatalogServiceTemplates.byId(profile.templateId);
      expect(template, isNotNull);
      final rows = CatalogServiceTemplateEngine.detailRows(template: template!, profile: profile);
      expect(rows, isNotEmpty);
      expect(rows.every((r) => r.display.trim().isNotEmpty), isTrue);
      expect(rows.any((r) => r.display.contains('session_kind')), isFalse);
    });

    test('structured answer states are respected', () {
      final profile = CatalogServiceProfile.fromServiceProfileJson({
        'templateId': 'salon_hair_cut',
        'templateVersion': 1,
        'priceMode': 'fixed',
        'answers': {
          'includes': {'state': 'notApplicable'},
          'session_kind': {'state': 'value', 'value': 'package'},
        },
      });
      expect(profile.answer('includes').state, CatalogServiceAnswerState.notApplicable);
      expect(profile.answer('session_kind').asString(), 'package');
    });

    test('camelCase storage aliases map to Flutter field ids', () {
      final profile = CatalogServiceProfile.fromServiceProfileJson({
        'templateId': 'salon_hair_cut',
        'templateVersion': 1,
        'priceMode': 'fixed',
        'answers': {
          'included': ['wash'],
          'packageSessions': 4,
        },
      });
      expect(profile.answer('includes').asStringList(), ['wash']);
      expect(profile.answer('package_sessions').asInt(), 4);
      final template = CatalogServiceTemplates.byId('salon_hair_cut');
      expect(template, isNotNull);
      final rows = CatalogServiceTemplateEngine.detailRows(template: template!, profile: profile);
      expect(rows.any((r) => r.field.id == 'includes'), isTrue);
      expect(rows.any((r) => r.display.contains('included')), isFalse);
    });
  });
}
