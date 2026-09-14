/**
 * Phase 5 surgical — YouCam capture taxonomy must never become HTTP 503.
 */
import assert from 'node:assert/strict';
import {
  classifyYouCamCaptureError,
  isFaceQualityYouCamError,
  isFaceRecaptureImmediateYouCamError,
} from './youcam-face-errors';
import {
  classifyProviderFailure,
  toClientProviderError,
} from '../../ports/shared/provider-error';
import { HttpExceptionFilter } from '../../common/filters/http-exception.filter';
import {
  BadRequestException,
  GatewayTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';

function testLightingDarkIsCaptureQuality(): void {
  const c = classifyYouCamCaptureError(
    'YouCam task error: "error_lighting_dark"',
  );
  assert.ok(c);
  assert.equal(c!.code, 'CAPTURE_LIGHTING_TOO_DARK');
  assert.equal(c!.category, 'capture_quality');
  assert.equal(c!.requiresRecapture, true);
  assert.equal(c!.userAction, 'recapture');
  assert.ok(isFaceQualityYouCamError('error_lighting_dark'));

  const pe = classifyProviderFailure({
    message: 'YouCam task error: "error_lighting_dark"',
    provider: 'perfect_corp',
    traceId: 't-light',
  });
  assert.equal(pe.code, 'image_quality_failure');
  assert.equal(pe.captureCode, 'CAPTURE_LIGHTING_TOO_DARK');
  assert.equal(pe.requiresRecapture, true);
}

function testFaceOutOfBoundIsCaptureQualityNot503(): void {
  assert.ok(
    isFaceRecaptureImmediateYouCamError(
      'YouCam task error: "error_src_face_out_of_bound"',
    ),
  );
  const c = classifyYouCamCaptureError(
    'YouCam skin analysis failed: YouCam task error: "error_src_face_out_of_bound"',
  );
  assert.ok(c);
  assert.equal(c!.code, 'CAPTURE_FACE_OUT_OF_BOUNDS');
  assert.equal(c!.requiresRecapture, true);

  const pe = classifyProviderFailure({
    message:
      'YouCam skin analysis failed: YouCam task error: "error_src_face_out_of_bound"',
    provider: 'perfect_corp',
    traceId: 't-oob',
  });
  assert.equal(pe.code, 'image_quality_failure');
  assert.notEqual(pe.code, 'provider_unavailable');
  assert.notEqual(pe.code, 'internal_error');
}

function testProviderUnavailableStays503Semantics(): void {
  const pe = classifyProviderFailure({
    message: 'upstream 503 unavailable',
    provider: 'perfect_corp',
    traceId: 't-503',
  });
  assert.equal(pe.code, 'provider_unavailable');
  assert.equal(pe.requiresRecapture, false);
  assert.equal(pe.userAction, 'retry');
}

function testTimeoutMaps(): void {
  const pe = classifyProviderFailure({
    message: 'YouCam task timed out after 90s',
    provider: 'perfect_corp',
    traceId: 't-to',
  });
  assert.equal(pe.code, 'provider_timeout');
  const client = toClientProviderError(pe);
  assert.ok(client.message.includes('وقتًا') || client.message.length > 0);
  assert.equal(client.category, 'timeout');
}

function testClientPayloadAlwaysHasMessage(): void {
  const pe = classifyProviderFailure({
    message: 'secret-token-should-not-leak xyz',
    provider: 'perfect_corp',
    traceId: 't-msg',
  });
  const client = toClientProviderError(pe);
  assert.equal(typeof client.message, 'string');
  assert.ok(client.message.length > 0);
  assert.equal(JSON.stringify(client).includes('secret-token'), false);
  assert.equal('internalDetails' in client, false);
}

function testFilterNeverLeaksClassName(): void {
  const filter = new HttpExceptionFilter();
  const jsonBodies: unknown[] = [];
  const res = {
    status(code: number) {
      return {
        json(body: unknown) {
          jsonBodies.push({ status: code, body });
        },
      };
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ method: 'POST', originalUrl: '/api/v1/ai/skin-analysis' }),
    }),
  };

  // Object without message → would historically become "Service Unavailable Exception"
  filter.catch(
    new ServiceUnavailableException({
      code: 'provider_unavailable',
      safeUserMessageKey: 'errors.provider_unavailable',
      retryable: true,
      provider: 'perfect_corp',
      traceId: 'x',
    } as never),
    host as never,
  );
  const last = jsonBodies.at(-1) as { status: number; body: { message: string } };
  assert.equal(last.status, 503);
  assert.ok(!last.body.message.toLowerCase().includes('exception'));
  assert.ok(last.body.message.includes('تحليل') || last.body.message.length > 10);

  filter.catch(
    new BadRequestException({
      code: 'CAPTURE_FACE_OUT_OF_BOUNDS',
      category: 'capture_quality',
      message: 'تأكد من ظهور الوجه كاملًا داخل الإطار ثم أعد التقاط الصورة.',
      retryable: false,
      requiresRecapture: true,
      userAction: 'recapture',
    }),
    host as never,
  );
  const bad = jsonBodies.at(-1) as {
    status: number;
    body: { message: string; code?: string; requiresRecapture?: boolean };
  };
  assert.equal(bad.status, 400);
  assert.equal(bad.body.code, 'CAPTURE_FACE_OUT_OF_BOUNDS');
  assert.equal(bad.body.requiresRecapture, true);
  assert.ok(!bad.body.message.toLowerCase().includes('exception'));

  filter.catch(new GatewayTimeoutException(toClientProviderError({
    code: 'provider_timeout',
    retryable: true,
    safeUserMessageKey: 'errors.provider_timeout',
    provider: 'perfect_corp',
    traceId: 'tt',
  })), host as never);
  const to = jsonBodies.at(-1) as { status: number; body: { message: string } };
  assert.equal(to.status, 504);
  assert.ok(!to.body.message.toLowerCase().includes('exception'));
}

function main(): void {
  testLightingDarkIsCaptureQuality();
  testFaceOutOfBoundIsCaptureQualityNot503();
  testProviderUnavailableStays503Semantics();
  testTimeoutMaps();
  testClientPayloadAlwaysHasMessage();
  testFilterNeverLeaksClassName();
  console.log('phase5-face-analysis-surgical.schema-tests: PASS');
}

main();
