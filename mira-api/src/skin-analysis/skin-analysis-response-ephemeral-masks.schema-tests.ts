/**
 * Proves SkinAnalysisResponseDto includes ephemeralMasks (session-only).
 * Run: npx tsx src/skin-analysis/skin-analysis-response-ephemeral-masks.schema-tests.ts
 */
import assert from 'node:assert/strict';
import { SkinAnalysisResponseDto } from './dto/skin-analysis-response.dto';

function section(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`, e);
    process.exitCode = 1;
  }
}

const miraStub = {
  version: 'test',
  scoreSchemaVersion: 'test',
  overallBeautyScore: 70,
} as unknown as SkinAnalysisResponseDto['miraReport'];

section('omits_ephemeralMasks_when_missing', () => {
  const dto = SkinAnalysisResponseDto.from(
    'id1',
    new Date('2026-09-14T00:00:00.000Z'),
    miraStub,
    undefined,
    undefined,
  );
  assert.equal('ephemeralMasks' in dto, false);
});

section('includes_ephemeralMasks_when_present', () => {
  const dto = SkinAnalysisResponseDto.from(
    'id1',
    new Date('2026-09-14T00:00:00.000Z'),
    miraStub,
    undefined,
    [
      {
        concernType: 'hd_pore',
        region: 'whole',
        scoreOnly: false,
        width: 1200,
        height: 1680,
        maskBase64: 'aGVsbG8=',
      },
      {
        concernType: 'hd_moisture',
        scoreOnly: true,
      },
    ],
  );
  assert.ok(dto.ephemeralMasks);
  assert.equal(dto.ephemeralMasks!.length, 2);
  assert.equal(dto.ephemeralMasks![0]!.concernType, 'hd_pore');
  assert.equal(dto.ephemeralMasks![0]!.maskBase64, 'aGVsbG8=');
  // Never assert on face/mask image content beyond tiny fixture.
});

section('omits_ephemeralMasks_when_empty_array', () => {
  const dto = SkinAnalysisResponseDto.from(
    'id1',
    new Date('2026-09-14T00:00:00.000Z'),
    miraStub,
    undefined,
    [],
  );
  assert.equal('ephemeralMasks' in dto, false);
});

console.log('done skin-analysis-response-ephemeral-masks.schema-tests');
