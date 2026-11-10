import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateOpenScreenRefreshResult } from '../mira-api/src/marketplace/taxonomy/elegance-e3-acceptance-evaluators.ts';

const good = {
  ok: true,
  definitionsVersionAtOpen: '1',
  definitionsVersionAfterRefresh: '2',
  screenSawUpdatedProduct: true,
  refreshWhileOpenVerified: true,
  filterUiTransitionVerified: true,
  debugRefreshUsed: false,
  searchFallbackUsed: false,
  replaceForTestUsed: false,
  cacheCleared: false,
  appRelaunched: false,
  nameArAfter: 'منتج محدّث',
  oldNameAcceptedAlone: false,
  cancelledFilterStillSelected: false,
  unexpectedError: null,
  knownOutOfScopeExceptions: [],
};

test('open-screen evaluator accepts a complete successful evidence shape', () => {
  assert.equal(evaluateOpenScreenRefreshResult(good).ok, true);
});

test('open-screen evaluator rejects unchanged definitions version', () => {
  assert.equal(
    evaluateOpenScreenRefreshResult({
      ...good,
      definitionsVersionAfterRefresh: '1',
    }).ok,
    false,
  );
});

test('open-screen evaluator rejects old results without updated product name', () => {
  assert.equal(
    evaluateOpenScreenRefreshResult({
      ...good,
      screenSawUpdatedProduct: false,
      oldNameAcceptedAlone: true,
    }).ok,
    false,
  );
});

test('open-screen evaluator rejects cancelled filter still selected', () => {
  assert.equal(
    evaluateOpenScreenRefreshResult({
      ...good,
      cancelledFilterStillSelected: true,
      filterUiTransitionVerified: false,
    }).ok,
    false,
  );
});

test('open-screen evaluator rejects unexpected errors', () => {
  assert.equal(
    evaluateOpenScreenRefreshResult({
      ...good,
      unexpectedError: 'NetworkImageLoadException: 404',
    }).ok,
    false,
  );
});

test('open-screen evaluator rejects debug refresh / search fallback / cache clear', () => {
  assert.equal(evaluateOpenScreenRefreshResult({ ...good, debugRefreshUsed: true }).ok, false);
  assert.equal(evaluateOpenScreenRefreshResult({ ...good, searchFallbackUsed: true }).ok, false);
  assert.equal(evaluateOpenScreenRefreshResult({ ...good, cacheCleared: true }).ok, false);
});
