import assert from 'node:assert/strict';
import { formatCatalogPrice } from './catalog-price';
import { MarketplaceService } from './marketplace.service';

const service = new MarketplaceService({} as never);

assert.equal(formatCatalogPrice(8900), '89 ر.س');
assert.equal(service.formatPrice(8900), '89 ر.س');
assert.equal(formatCatalogPrice(8999), '89.99 ر.س');
assert.equal(service.formatPrice(8999), '89.99 ر.س');
assert.equal(formatCatalogPrice(0), '0 ر.س');
assert.equal(formatCatalogPrice(null), null);
assert.equal(service.formatPrice(undefined), '');

console.log('catalog-price tests passed');
