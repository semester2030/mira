import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/tmp/mira-browser-driver/package.json');
const puppeteer = require('puppeteer-core');
const web = dirname(dirname(fileURLToPath(import.meta.url)));
const shots = join(web, '../../docs/mira-commerce-reference/evidence/portal-motion');
mkdirSync(shots, { recursive: true });
const url = 'file://' + join(web, 'dashboard.html') + '?motion-fixture=1';
const png = '/tmp/mira-portal-motion-pixel.png';
writeFileSync(png, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64'));

const notes = [];
function check(name, ok, detail) {
  if (!ok) throw new Error(name + (detail ? ': ' + detail : ''));
  notes.push(name);
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  timeout: 20000,
  pipe: true,
  args: ['--disable-gpu', '--no-first-run', '--disable-extensions', '--user-data-dir=/tmp/mira-chrome-portal-motion'],
});
const page = await browser.newPage();
page.setDefaultTimeout(8000);
const errors = [];
page.on('pageerror', (error) => errors.push(String(error)));
await page.setViewport({ width: 1100, height: 900 });
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.screenshot({ path: join(shots, '01-skeleton.png') });
check('skeleton', await page.$eval('#stats', (el) => el.getAttribute('aria-busy') === 'true' && el.querySelector('.skeleton-card-stat')));
check('catalog skeleton', await page.$eval('#catalogList', (el) => Boolean(el.querySelector('.skeleton-card-list'))));
await page.waitForFunction(() => document.getElementById('partnerName').textContent.includes('عيادة الاختبار'));
const loaded = await page.$eval('body', (el) => el.innerText);
check('impressions', loaded.includes('12'));
check('missing clicks', loaded.includes('غير متاح'));
check('empty catalog', loaded.includes('لا عناصر بعد'));
check('not loading sentence', !documentTextHas(loaded, 'جاري التحميل'));
await page.screenshot({ path: join(shots, '02-loaded.png') });

await page.evaluate(() => sessionStorage.setItem('mira-motion-booking', 'fail'));
await page.click('#commerceTabBookings');
await page.waitForFunction(() => document.body.innerText.includes('B-100'));
const before = await page.$eval('[data-id="b1"]', (el) => el.innerText);
await page.evaluate(() => {
  const card = document.querySelector('[data-id="b1"]');
  const button = Array.from(card.querySelectorAll('button')).find((node) => node.textContent === 'رفض');
  button.click();
});
await page.waitForFunction(() => document.getElementById('commerceStatus').textContent.includes('بقيت الحالة السابقة'));
const afterFail = await page.$eval('[data-id="b1"]', (el) => el.innerText);
check('booking kept', afterFail.includes('طلب موعد') && afterFail === before);
await page.evaluate(() => sessionStorage.removeItem('mira-motion-booking'));
await page.evaluate(() => {
  const card = document.querySelector('[data-id="b1"]');
  const button = Array.from(card.querySelectorAll('button')).find((node) => node.textContent === 'تأكيد الموعد');
  button.click();
});
await page.waitForFunction(() => document.querySelector('[data-id="b1"]').innerText.includes('موعد مؤكد'));
const summary = await page.$eval('#commerceStatus', (el) => el.textContent);
check('booking count', summary.includes('موعد مؤكد: 1'));
await page.screenshot({ path: join(shots, '06-booking.png') });

await page.type('input[name="nameAr"]', 'جلسة الحركة');
await page.select('select[name="category"]', 'skin');
await page.type('input[name="priceSar"]', '80');
const image = await page.$('#catalogForm-images');
await image.uploadFile(png);
await page.evaluate(() => sessionStorage.setItem('mira-motion-upload', 'fail'));
await page.evaluate(() => {
  const button = document.getElementById('catalogForm-save');
  button.click();
  button.click();
});
await page.waitForFunction(() => document.getElementById('catalogForm-save').textContent.includes('جارٍ الحفظ'));
await page.evaluate(() => document.getElementById('catalogForm-save').scrollIntoView({ block: 'center' }));
await page.screenshot({ path: join(shots, '04-save-busy.png') });
await page.waitForFunction(() => document.body.innerText.includes('رفض الخادم الملف'));
check('one save', await page.evaluate(() => window.MiraMotionFixture.calls.create === 1));
check('upload retried available', await page.evaluate(() => {
  const button = Array.from(document.querySelectorAll('button')).find((node) => node.textContent === 'إعادة المحاولة');
  return Boolean(button && !button.disabled);
}));
const kept = await page.$eval('input[name="nameAr"]', (el) => el.value);
check('form kept', kept === 'جلسة الحركة');
await page.evaluate(() => {
  const card = document.querySelector('.media-card');
  if (card) card.scrollIntoView({ block: 'center' });
});
await page.screenshot({ path: join(shots, '05-upload-fail.png') });

await page.evaluate(() => sessionStorage.setItem('mira-motion-dashboard', 'fail'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('loadErrorText').textContent.includes('انقطع الاتصال'));
check('retry button', await page.$eval('#loadingRetry', (el) => el.textContent === 'إعادة المحاولة'));
await page.screenshot({ path: join(shots, '03-load-error.png') });
await page.evaluate(() => sessionStorage.removeItem('mira-motion-dashboard'));
await page.click('#loadingRetry');
await page.waitForFunction(() => document.getElementById('partnerName').textContent.includes('عيادة الاختبار'));

await page.setViewport({ width: 390, height: 844 });
await page.screenshot({ path: join(shots, '07-mobile.png') });
const dir = await page.$eval('html', (el) => el.getAttribute('dir'));
check('rtl', dir === 'rtl');

await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => document.getElementById('partnerName').textContent.includes('عيادة الاختبار'));
const animation = await page.$eval('.num', (el) => getComputedStyle(el).animationName);
check('reduced motion', animation === 'none', animation);
check('no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
console.log('MOTION_BROWSER_PASS ' + notes.join(' | '));

function documentTextHas(text, needle) {
  return text.includes(needle);
}
