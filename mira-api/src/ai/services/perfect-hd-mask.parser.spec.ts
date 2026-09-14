import assert from 'node:assert/strict';
import {
  classifySpatialMode,
  mayShowSpatialOverlay,
} from '../contracts/perfect-spatial-skin-concern';
import { PERFECT_HD_FACE_EXPLORER_ACTIONS } from '../contracts/perfect-hd-mask.types';
import {
  assertHdOnlyActions,
  parsePerfectHdMaskPayload,
} from './perfect-hd-mask.parser';
import { normalizeHdConcernType } from './materialize-hd-masks';

function section(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`, e);
    process.exitCode = 1;
  }
}

section('hd_only_rejects_sd_mix', () => {
  assert.throws(() => assertHdOnlyActions(['hd_pore', 'pore']), /mix HD and SD/);
});

section('hd_only_requires_hd', () => {
  assert.throws(() => assertHdOnlyActions(['pore', 'wrinkle']), /hd_\*/);
});

section('parse_output_array_preserves_raw_ui_masks', () => {
  const parsed = parsePerfectHdMaskPayload({
    task_status: 'success',
    results: {
      output: [
        {
          type: 'hd_age_spot',
          raw_score: 41.2,
          ui_score: 55,
          mask_urls: ['https://example.com/hd_age_spot.png'],
          output_mask_name: 'hd_age_spot_output.png',
        },
        {
          type: 'hd_redness',
          raw_score: 70,
          ui_score: 72,
        },
      ],
    },
  });
  assert.equal(parsed.hasAnyMask, true);
  const spot = parsed.artifacts.find((a) => a.concernType === 'hd_age_spot');
  assert.ok(spot);
  assert.equal(spot!.rawScore, 41.2);
  assert.equal(spot!.uiScore, 55);
  assert.equal(spot!.scoreOnly, false);
  assert.equal(spot!.outputMaskName, 'hd_age_spot_output.png');
  const redness = parsed.artifacts.find((a) => a.concernType === 'hd_redness');
  assert.ok(redness);
  assert.equal(redness!.scoreOnly, true);
});

section('parse_pore_subcategories', () => {
  const parsed = parsePerfectHdMaskPayload({
    results: {
      hd_pore: {
        forehead: {
          raw_score: 10,
          ui_score: 20,
          output_mask_name: 'hd_pore_output_forehead.png',
        },
        nose: {
          raw_score: 11,
          ui_score: 21,
          output_mask_name: 'hd_pore_output_nose.png',
        },
        cheek: {
          raw_score: 12,
          ui_score: 22,
          output_mask_name: 'hd_pore_output_cheek.png',
        },
        whole: {
          raw_score: 13,
          ui_score: 23,
          output_mask_name: 'hd_pore_output_all.png',
          mask_urls: ['https://example.com/pore_all.png'],
        },
      },
    },
  });
  const pores = parsed.artifacts.filter((a) => a.concernType === 'hd_pore');
  assert.equal(pores.length, 4);
  assert.ok(pores.some((p) => p.region === 'forehead'));
  assert.ok(pores.some((p) => p.region === 'cheek'));
  assert.ok(!pores.some((p) => p.region === 'left_cheek'));
});

section('parse_wrinkle_subcategories', () => {
  const parsed = parsePerfectHdMaskPayload({
    hd_wrinkle: {
      forehead: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_forehead.png' },
      glabellar: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_glabellar.png' },
      crowfeet: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_crowfeet.png' },
      periocular: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_periocular.png' },
      nasolabial: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_nasolabial.png' },
      marionette: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_marionette.png' },
      whole: { raw_score: 1, ui_score: 2, output_mask_name: 'hd_wrinkle_output_all.png' },
    },
  });
  assert.equal(
    parsed.artifacts.filter((a) => a.concernType === 'hd_wrinkle').length,
    7,
  );
});

section('missing_mask_is_score_only_not_fabricated', () => {
  const parsed = parsePerfectHdMaskPayload({
    results: {
      output: [{ type: 'hd_texture', ui_score: 80, raw_score: 77.5 }],
    },
  });
  assert.equal(parsed.hasAnyMask, false);
  assert.equal(parsed.artifacts[0]?.scoreOnly, true);
  assert.equal(parsed.artifacts[0]?.maskUrls.length, 0);
});

section('parse_remaining_hd_inventory_actions', () => {
  const parsed = parsePerfectHdMaskPayload({
    results: {
      output: [
        {
          type: 'hd_moisture',
          raw_score: 60.1,
          ui_score: 70,
          mask_urls: ['https://example.com/hd_moisture.png'],
        },
        {
          type: 'hd_dark_circle',
          raw_score: 50,
          ui_score: 55,
          mask_urls: ['https://example.com/hd_dark_circle.png'],
        },
        {
          type: 'hd_firmness',
          raw_score: 90,
          ui_score: 88,
          mask_urls: ['https://example.com/hd_firmness.png'],
        },
      ],
      hd_acne: {
        whole: {
          raw_score: 40,
          ui_score: 50,
          mask_urls: ['https://example.com/hd_acne.png'],
        },
      },
      hd_skin_type: {
        whole: { mask_urls: ['https://example.com/st_whole.png'] },
        t_zone: { mask_urls: ['https://example.com/st_t.png'] },
        u_zone: { mask_urls: ['https://example.com/st_u.png'] },
      },
    },
  });
  assert.equal(
    parsed.artifacts.find((a) => a.concernType === 'hd_moisture')?.rawScore,
    60.1,
  );
  assert.equal(
    parsed.artifacts.find((a) => a.concernType === 'hd_moisture')?.uiScore,
    70,
  );
  assert.notEqual(
    parsed.artifacts.find((a) => a.concernType === 'hd_moisture')?.rawScore,
    parsed.artifacts.find((a) => a.concernType === 'hd_moisture')?.uiScore,
  );
  assert.equal(
    parsed.artifacts.filter((a) => a.concernType === 'hd_skin_type').length,
    3,
  );
  assert.ok(
    parsed.artifacts.some(
      (a) => a.concernType === 'hd_acne' && a.region === 'whole',
    ),
  );
});

section('spatialMode_classifier_and_overlay_gate', () => {
  assert.equal(
    classifySpatialMode({
      hasRootMask: true,
      subregionMaskCount: 0,
      hasScore: true,
    }),
    'PROVIDER_PIXEL_MASK',
  );
  assert.equal(
    classifySpatialMode({
      hasRootMask: false,
      subregionMaskCount: 4,
      hasScore: true,
    }),
    'PROVIDER_SUBREGION_MASKS',
  );
  assert.equal(
    classifySpatialMode({
      hasRootMask: false,
      subregionMaskCount: 0,
      hasScore: true,
    }),
    'SCORE_ONLY',
  );
  assert.equal(mayShowSpatialOverlay('SCORE_ONLY'), false);
  assert.equal(mayShowSpatialOverlay('PROVIDER_PIXEL_MASK'), true);
  assert.equal(mayShowSpatialOverlay('PROVIDER_SUBREGION_MASKS'), true);
});

section('no_landmark_fallback_in_score_only', () => {
  const parsed = parsePerfectHdMaskPayload({
    results: { output: [{ type: 'hd_radiance', raw_score: 1, ui_score: 2 }] },
  });
  assert.equal(parsed.artifacts[0]?.scoreOnly, true);
  assert.equal(parsed.artifacts[0]?.maskUrls.length, 0);
  // Contract: SCORE_ONLY must not invent masks / landmark fallback.
  assert.equal(
    mayShowSpatialOverlay(
      classifySpatialMode({
        hasRootMask: false,
        subregionMaskCount: 0,
        hasScore: true,
      }),
    ),
    false,
  );
});

section('normalize_hd_concern_type_for_skin_scores', () => {
  assert.equal(normalizeHdConcernType('hd_pore'), 'pore');
  assert.equal(normalizeHdConcernType('hd_age_spot'), 'age_spot');
  assert.equal(normalizeHdConcernType('moisture'), 'moisture');
});

section('face_explorer_actions_are_hd_only', () => {
  assertHdOnlyActions(PERFECT_HD_FACE_EXPLORER_ACTIONS);
  assert.ok(PERFECT_HD_FACE_EXPLORER_ACTIONS.includes('hd_pore'));
  assert.ok(PERFECT_HD_FACE_EXPLORER_ACTIONS.includes('hd_moisture'));
  assert.ok(!PERFECT_HD_FACE_EXPLORER_ACTIONS.includes('hd_skin_type'));
});

if (process.exitCode) {
  console.error('perfect-hd-mask.parser tests FAILED');
  process.exit(1);
}
console.log('perfect-hd-mask.parser tests OK');
