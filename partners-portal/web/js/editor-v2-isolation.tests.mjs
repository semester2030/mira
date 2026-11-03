/**
 * P1 RC3 — account isolation via real PartnersApi.saveSession path (no manual bumpEpoch).
 * A schedules save → saveSession(B) before timer → zero requests with A's data under B token.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function loadScript(filename, sandbox) {
  const code = fs.readFileSync(path.join(__dirname, filename), 'utf8');
  vm.runInNewContext(code, sandbox, { filename });
}

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(String(k), String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
    _map: map,
  };
}

async function main() {
  const calls = [];
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const listeners = Object.create(null);

  const sandbox = {
    console,
    localStorage,
    sessionStorage,
    URLSearchParams,
    crypto: { randomUUID: () => 'test-uuid' },
    window: null,
    document: { querySelector: () => null },
    location: { hostname: '127.0.0.1', search: '', href: 'http://127.0.0.1/dashboard.html' },
    fetch: async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8), json: async () => ({}) }),
    AbortController: class {
      constructor() {
        this.signal = { aborted: false, addEventListener() {} };
        this._reason = null;
      }
      abort(reason) {
        this.signal.aborted = true;
        this._reason = reason;
      }
    },
    CustomEvent: class {
      constructor(type, init) {
        this.type = type;
        this.detail = init && init.detail;
      }
    },
    setTimeout: (fn) => {
      // Deferred; tests call flush / advance manually via Promise microtasks after saveSession.
      sandbox.__timers.push(fn);
      return sandbox.__timers.length;
    },
    clearTimeout: () => {},
    addEventListener: (type, fn) => {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    },
  };
  sandbox.window = sandbox;
  sandbox.__timers = [];
  sandbox.window.addEventListener = sandbox.addEventListener;
  sandbox.window.dispatchEvent = (ev) => {
    (listeners[ev.type] || []).forEach((fn) => fn(ev));
    return true;
  };

  loadScript('api.js', sandbox);
  const { PartnersApi } = sandbox.window;
  assert.ok(PartnersApi);

  // Replace putEditorDraft to record calls with live token/auth gen.
  PartnersApi.putEditorDraft = async (clientDraftId, payload) => {
    calls.push({
      clientDraftId,
      payload,
      token: localStorage.getItem('mira_partner_token'),
      partnerId: localStorage.getItem('mira_partner_id'),
      authGeneration: PartnersApi.authGeneration(),
    });
    return { revision: 1, clientDraftId };
  };

  loadScript('editor-v2.js', sandbox);
  const E = sandbox.window.MiraEditorV2;
  assert.ok(E);

  // Session A
  PartnersApi.saveSession('a@example.com', 'token-A-aaaaaaaa');
  localStorage.setItem('mira_partner_id', 'partner-A');
  E.state.enabled = true;
  E.state.registryReady = true;
  E.state.registryMismatch = false;
  E.state.partnerId = 'partner-A';
  E.state.sessionEpoch = 1;
  sessionStorage.setItem('mira_editor_v2_session_epoch', '1');
  E.state.authGeneration = PartnersApi.authGeneration();
  E.state.tokenFingerprint = PartnersApi.authTokenFingerprint();

  const form = {
    id: 'catalogForm',
    querySelector: () => null,
    insertBefore: () => {},
    firstChild: null,
  };

  E.scheduleAutosave(form, () => ({
    clientDraftId: 'draft-A',
    kind: 'product',
    profileId: 'product.clothes',
    targetOwnerId: null,
    values: { nameAr: 'منتج A' },
  }));
  assert.equal(sandbox.__timers.length, 1);

  // Real auth path: B logs in via saveSession (clears partner id, bumps auth gen, cancels pending).
  PartnersApi.saveSession('b@example.com', 'token-B-bbbbbbbb');
  // Stale partner id must not remain authoritative; saveSession cleared it.
  assert.equal(localStorage.getItem('mira_partner_id'), null);
  // Simulate late metadata for B (after auth switch).
  localStorage.setItem('mira_partner_id', 'partner-B');
  E.state.partnerId = 'partner-B';
  E.state.enabled = true;
  E.state.registryReady = true;
  E.state.authGeneration = PartnersApi.authGeneration();
  E.state.tokenFingerprint = PartnersApi.authTokenFingerprint();

  // Fire deferred A timer — must not send.
  for (const fn of sandbox.__timers.splice(0)) {
    await fn();
  }
  assert.equal(calls.length, 0, 'A payload must not ride B session');

  // Stale response discard: schedule B, start flush, switch auth mid-flight.
  let resolvePut;
  const putPromise = new Promise((r) => { resolvePut = r; });
  PartnersApi.putEditorDraft = async (clientDraftId, payload) => {
    calls.push({
      phase: 'inflight',
      clientDraftId,
      token: localStorage.getItem('mira_partner_token'),
      authGeneration: PartnersApi.authGeneration(),
    });
    await putPromise;
    return { revision: 2, clientDraftId };
  };

  E.scheduleAutosave(form, () => ({
    clientDraftId: 'draft-B',
    kind: 'product',
    profileId: 'product.clothes',
    values: { nameAr: 'منتج B' },
  }));
  const flushP = E.flush(form);
  // Switch to C while B request in flight via real saveSession.
  PartnersApi.saveSession('c@example.com', 'token-C-cccccccc');
  resolvePut({ revision: 2 });
  const result = await flushP;
  assert.equal(result.ok, false);
  assert.ok(result.cancelled || result.reason === 'stale-response' || result.reason === 'auth-changed' || result.reason === 'aborted');

  console.log(JSON.stringify({ ok: true, calls: calls.filter((c) => c.clientDraftId === 'draft-A').length, totalCalls: calls.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
