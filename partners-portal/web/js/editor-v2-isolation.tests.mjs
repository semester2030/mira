/**
 * P1 RC2 — account isolation for editor-v2 autosave (no network).
 * Simulates: A schedules save → switch to B before timer → flush must not send A's payload with B session.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const code = readFileSync(join(root, 'editor-v2.js'), 'utf8');

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

async function main() {
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const calls = [];
  const PartnersApi = {
    registry: async () => ({
      editorV2Enabled: true,
      registryHash: 'abc',
      schemaVersion: 2,
    }),
    putEditorDraft: async (clientDraftId, payload) => {
      calls.push({
        tokenPartner: localStorage.getItem('mira_partner_id'),
        clientDraftId,
        payload,
      });
      return { revision: 1 };
    },
  };
  const sandbox = {
    window: {
      addEventListener: () => {},
      sessionPartner: { id: 'partner-A', type: 'salon' },
      PartnersApi,
    },
    localStorage,
    sessionStorage,
    crypto: { randomUUID: () => 'uuid-test' },
    AbortController: class {
      abort() {}
    },
    PartnersApi,
    console,
    setTimeout: (fn) => {
      // run immediately for tests that call flush; scheduleAutosave uses real timer — override below
      return 1;
    },
    clearTimeout: () => {},
  };
  // deterministic timers
  const timers = [];
  sandbox.setTimeout = (fn, ms) => {
    const id = timers.length + 1;
    timers.push({ id, fn, ms });
    return id;
  };
  sandbox.clearTimeout = (id) => {
    const i = timers.findIndex((t) => t.id === id);
    if (i >= 0) timers.splice(i, 1);
  };

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const E = sandbox.window.MiraEditorV2;
  assert.ok(E);

  localStorage.setItem('mira_partner_id', 'partner-A');
  localStorage.setItem('mira_partner_email', 'a@test.local');
  await E.bootstrap({ id: 'partner-A', type: 'salon' });
  assert.equal(E.state.enabled, true);

  const form = { id: 'serviceForm', querySelector: () => null };
  let builtFor = null;
  E.scheduleAutosave(form, () => {
    builtFor = E.state.partnerId;
    return {
      clientDraftId: 'draft-A',
      kind: 'service',
      profileId: 'service.salon_hair_cut',
      values: { nameAr: 'من حساب A' },
      targetOwnerId: null,
    };
  });
  assert.equal(timers.length, 1);

  // Switch account before timer fires
  localStorage.setItem('mira_partner_id', 'partner-B');
  localStorage.setItem('mira_partner_email', 'b@test.local');
  E.bumpEpoch('test-switch');
  await E.bootstrap({ id: 'partner-B', type: 'salon' });

  // Fire leftover timer if any — should no-op or cancel
  while (timers.length) {
    const t = timers.shift();
    await t.fn();
  }

  assert.equal(calls.length, 0, 'must not send A payload after switch to B');
  assert.equal(builtFor, null);

  // Stale response discard: schedule under B, capture snapshot, switch away before await resolves
  let resolvePut;
  PartnersApi.putEditorDraft = () =>
    new Promise((resolve) => {
      resolvePut = () => resolve({ revision: 9 });
    });
  E.scheduleAutosave(form, () => ({
    clientDraftId: 'draft-B',
    kind: 'service',
    profileId: 'service.salon_hair_cut',
    values: { nameAr: 'من حساب B' },
  }));
  const flushPromise = (async () => {
    while (timers.length) {
      const t = timers.shift();
      await t.fn();
    }
  })();
  // switch before response
  localStorage.setItem('mira_partner_id', 'partner-A');
  E.bumpEpoch('switch-during-inflight');
  resolvePut();
  await flushPromise;
  assert.equal(E.state.draftRevisionByClientId['draft-B'], undefined);

  console.log(JSON.stringify({ ok: true, calls: calls.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
