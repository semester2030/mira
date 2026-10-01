import 'package:flutter_test/flutter_test.dart';
import 'package:mirra/features/marketplace/data/discover_visual_preview_catalog.dart';
import 'package:mirra/features/marketplace/domain/catalog_service_template.dart';

void main() {
  group('CatalogServiceTemplates', () {
    test('each template has stable id version and partner scope', () {
      expect(CatalogServiceTemplates.all, isNotEmpty);
      for (final template in CatalogServiceTemplates.all) {
        expect(template.id, isNotEmpty);
        expect(template.version, greaterThan(0));
        expect(template.partnerTypes, isNotEmpty);
        expect(template.fields, isNotEmpty);
      }
    });

    test('salon hair category offers cut and color only for salon', () {
      final salon = CatalogServiceTemplates.forPartnerCategory(partnerType: 'salon', category: 'hair');
      expect(salon.map((t) => t.id), containsAll(['salon_hair_cut', 'salon_hair_color']));
      expect(salon.every((t) => t.partnerTypes.contains('salon')), isTrue);
      final clinicLaser = CatalogServiceTemplates.forPartnerCategory(partnerType: 'clinic', category: 'laser');
      expect(clinicLaser.single.id, 'clinic_laser');
      expect(
        CatalogServiceTemplates.forPartnerCategory(partnerType: 'salon', category: 'laser'),
        isEmpty,
      );
    });

    test('package fields appear only when session is package', () {
      final template = CatalogServiceTemplates.laser;
      final hidden = CatalogServiceTemplateEngine.visibleFields(template, {
        'session_kind': const CatalogServiceAnswer.value('single'),
      });
      expect(hidden.any((f) => f.id == 'package_sessions'), isFalse);

      final shown = CatalogServiceTemplateEngine.visibleFields(template, {
        'session_kind': const CatalogServiceAnswer.value('package'),
      });
      expect(shown.any((f) => f.id == 'package_sessions'), isTrue);
    });

    test('unset is not rendered as no in details', () {
      final template = CatalogServiceTemplates.hairCut;
      final profile = CatalogServiceProfile(
        templateId: template.id,
        templateVersion: template.version,
        answers: {
          'cut_style': const CatalogServiceAnswer.value('cut'),
          'includes_wash_dry': const CatalogServiceAnswer.unset(),
          'needs_assessment': const CatalogServiceAnswer.value(false),
        },
      );
      final rows = CatalogServiceTemplateEngine.detailRows(template: template, profile: profile);
      expect(rows.any((row) => row.field.id == 'includes_wash_dry'), isFalse);
      expect(rows.any((row) => row.field.id == 'needs_assessment' && row.display.contains('لا')), isTrue);
    });

    test('template switch reports stale answer ids', () {
      final stale = CatalogServiceTemplateEngine.staleAnswerIds(
        previous: CatalogServiceTemplates.hairCut,
        next: CatalogServiceTemplates.nails,
        answers: {
          'cut_style': const CatalogServiceAnswer.value('cut'),
          'place_mode': const CatalogServiceAnswer.value('branch'),
        },
      );
      expect(stale, contains('cut_style'));
      expect(stale, isNot(contains('place_mode')));
    });
  });

  group('preview service cases', () {
    test('covers required template scenarios with matching media', () {
      final byId = {
        for (final offer in DiscoverVisualPreviewCatalog.offers.where((o) => o.kind == 'service'))
          offer.id: offer,
      };
      expect(byId['preview-salon-hair']!.product, isNull);
      expect(byId['preview-salon-hair']!.service!.profile.templateId, 'salon_hair_cut');
      expect(byId['preview-salon-color']!.service!.profile.priceMode, CatalogServicePriceMode.from);
      expect(byId['preview-salon-nails']!.service!.profile.answer('addons').asStringList(), contains('art'));
      expect(byId['preview-salon-makeup']!.service!.profile.answer('prep_required').asString(), isNotEmpty);
      expect(byId['preview-clinic-skin']!.service!.profile.answer('needs_assessment').asBool(), isTrue);
      expect(byId['preview-clinic-laser']!.service!.profile.answer('session_kind').asString(), 'package');
      expect(byId['preview-clinic-consult']!.service!.profile.templateId, 'clinic_consult');
      expect(byId['preview-salon-care']!.service!.profile.templateId, 'salon_care');
      for (final offer in byId.values) {
        expect(offer.media, isNotEmpty);
        expect(offer.service!.partnerId, isNotEmpty);
      }
    });
  });
}
