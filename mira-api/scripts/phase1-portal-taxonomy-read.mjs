#!/usr/bin/env node
/**
 * Invoke the real portal unit PartnersApi.taxonomy (from api.js) against a live Nest base.
 * Usage:
 *   node scripts/phase1-portal-taxonomy-read.mjs --base=http://127.0.0.1:PORT/api/v1 --lane=jewelry --audience=partner
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.*)$/);
    return m ? [m[1], m[2]] : [a, true];
  }),
);
const base = String(args.base || '').replace(/\/$/, '');
const lane = String(args.lane || 'elegance');
const audience = args.audience ? String(args.audience) : '';
if (!base || !/^https?:\/\/(127\.0\.0\.1|localhost):\d+/.test(base)) {
  console.error('REFUSE: --base must be local http://127.0.0.1:PORT/api/v1');
  process.exit(2);
}

const apiPath = join(dirname(fileURLToPath(import.meta.url)), '../../partners-portal/web/js/api.js');
const source = readFileSync(apiPath, 'utf8');

const store = new Map();
const localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
const sessionStorage = { ...localStorage, _s: new Map() };
sessionStorage.getItem = (k) => (sessionStorage._s.has(k) ? sessionStorage._s.get(k) : null);
sessionStorage.setItem = (k, v) => sessionStorage._s.set(k, String(v));
sessionStorage.removeItem = (k) => sessionStorage._s.delete(k);

const location = {
  hostname: '127.0.0.1',
  search: `?api-base=${encodeURIComponent(base)}`,
  href: `http://127.0.0.1/dashboard.html?api-base=${encodeURIComponent(base)}`,
};

const document = {
  querySelector: (sel) => {
    if (sel === 'meta[name="mira-api-base"]') {
      return { getAttribute: () => base };
    }
    return null;
  },
};

const window = {
  localStorage,
  sessionStorage,
  location,
  document,
  dispatchEvent: () => true,
  PartnersApi: undefined,
  CustomEvent: class CustomEvent {
    constructor(type, init) {
      this.type = type;
      this.detail = init?.detail;
    }
  },
};
window.window = window;

const context = vm.createContext({
  window,
  document,
  localStorage,
  sessionStorage,
  location,
  fetch: globalThis.fetch.bind(globalThis),
  URLSearchParams,
  console,
});
vm.runInContext(source, context);

const PartnersApi = context.window.PartnersApi;
if (!PartnersApi || typeof PartnersApi.taxonomy !== 'function') {
  console.error('PartnersApi.taxonomy missing after loading api.js');
  process.exit(1);
}

const doc = await PartnersApi.taxonomy({
  lane,
  ...(audience ? { audience } : {}),
});
process.stdout.write(JSON.stringify(doc));
