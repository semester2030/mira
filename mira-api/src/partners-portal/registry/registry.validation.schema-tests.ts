/**
 * P1 RC2 — registry validation negatives/positives (no DB).
 */
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { HttpException } from '@nestjs/common';
import { RegistryService } from './registry.service';

function mustFail(fn: () => void, code: string) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (error) {
    assert.ok(error instanceof HttpException, String(error));
    const body = error.getResponse() as { code?: string };
    assert.equal(body.code, code, JSON.stringify(body));
  }
}

async function main() {
  const registry = new RegistryService();
  registry.load();
  const clothes = registry.assertProfileAllowed('product.clothes', 'brand', 'product');
  const salonCut = registry.assertProfileAllowed('service.salon_hair_cut', 'salon', 'service');

  // colors type array — reject number and unknown value
  mustFail(
    () =>
      registry.validateValues({
        profile: clothes,
        values: { colors: 123 as unknown as string[] },
        mode: 'draft',
        schemaVersion: 2,
        partnerType: 'brand',
      }),
    'FIELD_TYPE_INVALID',
  );
  mustFail(
    () =>
      registry.validateValues({
        profile: clothes,
        values: { colors: ['NOT_A_COLOR'] },
        mode: 'draft',
        schemaVersion: 2,
        partnerType: 'brand',
      }),
    'REGISTRY_UNKNOWN_VALUE',
  );

  // valid colors
  registry.validateValues({
    profile: clothes,
    values: { colors: ['black', 'ivory'] },
    mode: 'draft',
    schemaVersion: 2,
    partnerType: 'brand',
  });

  const sizeVals = (registry.getRegistry().fields.sizes?.values || []) as string[];
  if (sizeVals.length) {
    mustFail(
      () =>
        registry.validateValues({
          profile: clothes,
          values: { sizes: ['NOT_A_SIZE'] },
          mode: 'draft',
          schemaVersion: 2,
          partnerType: 'brand',
        }),
      'REGISTRY_UNKNOWN_VALUE',
    );
    registry.validateValues({
      profile: clothes,
      values: { sizes: [String(sizeVals[0])] },
      mode: 'draft',
      schemaVersion: 2,
      partnerType: 'brand',
    });
  }

  // serviceProfile unknown template
  mustFail(
    () =>
      registry.validateValues({
        profile: salonCut,
        values: {
          serviceProfile: {
            templateId: 'not_a_real_template',
            templateVersion: 1,
            priceMode: 'fixed',
            answers: {},
          },
        },
        mode: 'draft',
        schemaVersion: 2,
        partnerType: 'salon',
      }),
    'SERVICE_TEMPLATE_UNKNOWN',
  );

  // negative templateVersion
  mustFail(
    () =>
      registry.normalizeServiceProfile(
        { templateId: 'salon_hair_cut', templateVersion: -1, priceMode: 'fixed', answers: {} },
        'salon',
      ),
    'SERVICE_TEMPLATE_VERSION_INVALID',
  );

  // unknown priceMode
  mustFail(
    () =>
      registry.normalizeServiceProfile(
        { templateId: 'salon_hair_cut', templateVersion: 1, priceMode: 'weird', answers: {} },
        'salon',
      ),
    'SERVICE_PRICE_MODE_INVALID',
  );

  // unknown answers
  mustFail(
    () =>
      registry.normalizeServiceProfile(
        {
          templateId: 'salon_hair_cut',
          templateVersion: 1,
          priceMode: 'fixed',
          answers: { totally_unknown_field: 'x' },
        },
        'salon',
      ),
    'TEMPLATE_UNKNOWN_ANSWER',
  );

  // clinic template forbidden for salon
  mustFail(
    () =>
      registry.normalizeServiceProfile(
        { templateId: 'clinic_laser', templateVersion: 1, priceMode: 'fixed', answers: {} },
        'salon',
      ),
    'SERVICE_TEMPLATE_FORBIDDEN',
  );

  // empty draft values ok
  registry.validateValues({
    profile: clothes,
    values: {},
    mode: 'draft',
    schemaVersion: 2,
    partnerType: 'brand',
  });

  // serviceProfile with Flutter-compatible answers + alias remap
  const doc = registry.normalizeServiceProfile(
    {
      templateId: 'salon_hair_cut',
      templateVersion: 1,
      priceMode: 'fixed',
      answers: { includes: ['wash'], package_sessions: 3, session_kind: 'package' },
    },
    'salon',
  );
  assert.equal(doc.answers.includes != null || doc.answers.package_sessions != null, true);

  // Positive: every catalog template validates empty answers for its partner type
  for (const id of registry.listTemplateIds()) {
    const tplPartner = id.startsWith('clinic') ? 'clinic' : 'salon';
    registry.normalizeServiceProfile(
      { templateId: id, templateVersion: 1, priceMode: 'fixed', answers: {} },
      tplPartner,
    );
  }

  console.log(JSON.stringify({ ok: true, templates: registry.listTemplateIds().length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
