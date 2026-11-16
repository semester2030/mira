import assert from 'node:assert/strict';
import { createHash } from 'crypto';
import {
  extractAttachmentCatalogCues,
  extractEmbeddedLabelText,
  jpegWithCueMarker,
} from './attachment-catalog-cues';

async function main() {
  {
    const a = jpegWithCueMarker('منتج:مرطب الندى الليلي|براند:CeraVe|حجم:52ml');
    const b = jpegWithCueMarker('منتج:واقي شمس شفاف|براند:La Roche|حجم:50ml');
    assert.notEqual(
      createHash('sha256').update(a).digest('hex'),
      createHash('sha256').update(b).digest('hex'),
    );
    const cueA = await extractAttachmentCatalogCues({
      bytes: a,
      allowEmbeddedTestCues: true,
    });
    const cueB = await extractAttachmentCatalogCues({
      bytes: b,
      allowEmbeddedTestCues: true,
    });
    assert.equal(cueA.source, 'embedded_text');
    assert.equal(cueB.source, 'embedded_text');
    assert.notEqual(cueA.productNameAr, cueB.productNameAr);
    assert.match(cueA.productNameAr ?? '', /مرطب الندى/);
    assert.match(cueB.productNameAr ?? '', /واقي شمس/);
    console.log('pass two_images_different_product_cues');
  }

  {
    const hair = jpegWithCueMarker('تسريحة:لؤلؤ ناعم');
    const cue = await extractAttachmentCatalogCues({
      bytes: hair,
      allowEmbeddedTestCues: true,
    });
    assert.equal(cue.imageKind, 'outfit');
    assert.match(cue.hairstyleAr ?? cue.productNameAr ?? '', /لؤلؤ|تسريح/);
    console.log('pass hairstyle_cue_from_image_bytes');
  }

  {
    const withCue = jpegWithCueMarker('منتج:مرطب سري');
    const prod = await extractAttachmentCatalogCues({
      bytes: withCue,
      allowEmbeddedTestCues: false,
    });
    assert.equal(prod.source, 'none');
    assert.equal(prod.needsClarify, true);
    console.log('pass production_ignores_mira_cue_markers');
  }

  {
    const plain = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    assert.equal(extractEmbeddedLabelText(plain), null);
    const none = await extractAttachmentCatalogCues({ bytes: plain });
    assert.equal(none.source, 'none');
    assert.equal(none.needsClarify, true);
    console.log('pass no_cue_asks_clarify');
  }

  console.log('OK attachment-catalog-cues schema tests');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
