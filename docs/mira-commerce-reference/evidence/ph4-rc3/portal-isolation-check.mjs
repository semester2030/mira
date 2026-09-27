import fs from 'node:fs';
import vm from 'node:vm';

const root = new URL('../../../../', import.meta.url);

function load(file, { search, storage, hostname = '127.0.0.1' }) {
  const fetches = [];
  const sandbox = {
    console,
    location: { search, hostname },
    localStorage: {
      getItem: (key) => storage[key] ?? null,
      setItem: (key, value) => { storage[key] = value; },
      removeItem: (key) => { delete storage[key]; },
    },
    document: { querySelector: () => ({ getAttribute: () => 'http://127.0.0.1:9/api/v1' }) },
    fetch: async (url, init) => {
      fetches.push({ url: String(url), init });
      return { ok: true, status: 201, json: async () => ({ id: 'should-not-run' }) };
    },
    URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(new URL(file, root), 'utf8'), sandbox, { filename: file });
  return { fetches, sandbox };
}

const partnerStorage = { mira_partner_token: 'saved-partner-session' };
const labeled = load('partners-portal/web/js/api.js', { search: '?ui-fixture=labeled', storage: partnerStorage });
let labeledError = '';
try {
  await labeled.sandbox.PartnersApi.createAd({ captionAr: 'محاولة' });
} catch (error) {
  labeledError = error.message;
}
if (labeled.fetches.length !== 0) throw new Error('labeled partner mode sent a request');
if (!labeledError.includes('محاكاة')) throw new Error('labeled partner mode did not say it was simulated');
if (JSON.stringify(labeled.fetches).includes('saved-partner-session')) throw new Error('session leaked');

const normal = load('partners-portal/web/js/api.js', { search: '', storage: partnerStorage });
await normal.sandbox.PartnersApi.createAd({ captionAr: 'مسودة' });
if (normal.fetches.length !== 1) throw new Error('normal partner mode did not send');
if (!JSON.stringify(normal.fetches[0].init.headers).includes('saved-partner-session')) {
  throw new Error('normal partner mode omitted the session');
}

const adminStorage = { mira_admin_key: 'saved-admin-key' };
const adminLabeled = load('admin-portal/web/js/api.js', { search: '?ui-fixture=labeled', storage: adminStorage });
let adminError = '';
try {
  await adminLabeled.sandbox.MiraAdminApi.adDecision('ad', 'approve', 'note', 1);
} catch (error) {
  adminError = error.message;
}
if (adminLabeled.fetches.length !== 0) throw new Error('labeled admin mode sent a request');
if (!adminError.includes('محاكاة')) throw new Error('labeled admin mode did not say it was simulated');

const adminNormal = load('admin-portal/web/js/api.js', { search: '', storage: adminStorage });
await adminNormal.sandbox.MiraAdminApi.adDecision('ad', 'approve', 'note', 1);
if (adminNormal.fetches.length !== 1) throw new Error('normal admin mode did not send');
if (!JSON.stringify(adminNormal.fetches[0].init.headers).includes('saved-admin-key')) {
  throw new Error('normal admin mode omitted the key');
}

const remote = load('partners-portal/web/js/api.js', {
  search: '?api-base=https://evil.example/api',
  storage: partnerStorage,
  hostname: 'mira.example',
});
await remote.sandbox.PartnersApi.dashboard();
if (String(remote.fetches[0].url).includes('evil.example')) throw new Error('remote page honored api-base');

console.log('portal isolation check passed');
console.log('labeled fetches', labeled.fetches.length, adminLabeled.fetches.length);
console.log('normal fetches', normal.fetches.length, adminNormal.fetches.length);
