/**
 * Safari Lockdown Mode regression: celebrity avatar upload must not require FileReader.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const creatorSrc = fs.readFileSync(path.join(__dirname, 'creator-profile.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

assert.ok(!/new\s+FileReader\s*\(/.test(creatorSrc), 'creator-profile must not construct FileReader');
assert.ok(!/readAsDataURL|readAsArrayBuffer|fileToBase64/.test(creatorSrc), 'creator-profile must not Base64-read files');
assert.ok(creatorSrc.includes('setCreatorAvatarFile'), 'creator-profile must call multipart avatar helper');
assert.ok(apiSrc.includes('setCreatorAvatarFile'), 'api.js must expose setCreatorAvatarFile');
assert.ok(apiSrc.includes('requestMultipart'), 'api.js must send multipart without forcing JSON Content-Type');
assert.ok(apiSrc.includes("form.append('file'"), 'multipart field name must be file');

// Simulate Lockdown: FileReader missing; FormData + fetch still carry the Blob.
delete globalThis.FileReader;
assert.equal(typeof globalThis.FileReader, 'undefined');

class FakeFile extends Blob {
  constructor(parts, name, opts) {
    super(parts, opts);
    this.name = name;
    this.lastModified = Date.now();
  }
}

const captured = [];
globalThis.FormData = class FormData {
  constructor() {
    this._parts = [];
  }
  append(name, value, filename) {
    this._parts.push({ name, value, filename });
  }
};
globalThis.fetch = async (url, init) => {
  captured.push({ url, init });
  return {
    ok: true,
    async json() {
      return { hasAvatar: true, id: 'creator-1', displayNameAr: 'اختبار' };
    },
  };
};
globalThis.localStorage = {
  _m: new Map(),
  getItem(k) {
    return this._m.has(k) ? this._m.get(k) : null;
  },
  setItem(k, v) {
    this._m.set(k, String(v));
  },
  removeItem(k) {
    this._m.delete(k);
  },
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.document = {
  querySelector() {
    return null;
  },
};
globalThis.location = { hostname: '127.0.0.1', search: '?api-base=http://127.0.0.1:3000/api/v1', href: 'http://127.0.0.1:3000/dashboard.html' };
globalThis.URL = class URL {
  constructor(u) {
    this.href = String(u);
  }
};
globalThis.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init && init.detail;
  }
};
globalThis.window = globalThis;

const apiCode = apiSrc
  .replace(/^\(function \(\) \{/, 'void function () {')
  .replace(/\}\)\(\);\s*$/, '}();');
// api.js is an IIFE assigning window.PartnersApi — eval in this sandbox.
eval(apiCode);
assert.ok(globalThis.PartnersApi, 'PartnersApi exported');
assert.equal(typeof globalThis.PartnersApi.setCreatorAvatarFile, 'function');

const file = new FakeFile([Uint8Array.from([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' });
await globalThis.PartnersApi.setCreatorAvatarFile(file);

assert.equal(captured.length, 1, 'one multipart request');
assert.ok(captured[0].init.body instanceof globalThis.FormData, 'body is FormData');
assert.ok(!captured[0].init.headers || !captured[0].init.headers['Content-Type'], 'must not set multipart Content-Type manually');
assert.ok(
  String(captured[0].url).includes('/partners-portal/creator-profile/avatar'),
  'posts to creator avatar endpoint',
);
const parts = captured[0].init.body._parts;
assert.equal(parts.length, 1);
assert.equal(parts[0].name, 'file');
assert.equal(parts[0].filename, 'avatar.png');

console.log('creator-profile-lockdown.tests.mjs: PASS');
