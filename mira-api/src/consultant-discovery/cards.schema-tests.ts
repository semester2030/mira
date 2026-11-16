/**
 * Offer card action mapping — display → view / «عرض التفاصيل».
 */
import assert from 'node:assert/strict';
import { ConsultantDiscoveryService } from './consultant-discovery.service';

const svc = Object.create(ConsultantDiscoveryService.prototype) as ConsultantDiscoveryService;

const display = (svc as unknown as { toCard: (it: Record<string, unknown>) => { action: string; actionLabelAr: string } | null }).toCard({
  kind: 'product',
  id: '49d6042f-9961-403e-96cb-5379f2b2878d',
  nameAr: 'شنطة يد',
  priceHalalas: 18000,
  priceLabel: '180 ر.س',
  purchaseMode: 'display',
  stockAvailable: true,
});
assert.ok(display);
assert.equal(display!.action, 'view');
assert.equal(display!.actionLabelAr, 'عرض التفاصيل');

const cod = (svc as unknown as { toCard: (it: Record<string, unknown>) => { action: string } | null }).toCard({
  kind: 'product',
  id: 'p-cod',
  nameAr: 'منتج',
  priceHalalas: 10000,
  purchaseMode: 'internal_cod',
});
assert.equal(cod!.action, 'buy');

const book = (svc as unknown as { toCard: (it: Record<string, unknown>) => { action: string } | null }).toCard({
  kind: 'service',
  id: 's1',
  nameAr: 'مكياج',
  priceHalalas: 55000,
  bookingEnabled: true,
  branchId: 'b1',
});
assert.equal(book!.action, 'book');

const viewSvc = (svc as unknown as { toCard: (it: Record<string, unknown>) => { action: string } | null }).toCard({
  kind: 'service',
  id: 's2',
  nameAr: 'خدمة عرض',
  priceHalalas: 1000,
  bookingEnabled: false,
});
assert.equal(viewSvc!.action, 'view');

const oos = (svc as unknown as {
  toCard: (it: Record<string, unknown>) => { action: string; actionLabelAr: string; inStock: boolean | null } | null;
}).toCard({
  kind: 'product',
  id: 'p-oos',
  nameAr: 'مرطب نفد',
  priceHalalas: 9000,
  purchaseMode: 'external',
  stockAvailable: false,
});
assert.equal(oos!.action, 'view');
assert.equal(oos!.actionLabelAr, 'عرض التفاصيل');
assert.equal(oos!.inStock, false);

console.log('OK consultant cards action mapping');
