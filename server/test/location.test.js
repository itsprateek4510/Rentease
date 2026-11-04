const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { postalLocation, reverseLocation } = require('../utils/location');
afterEach(() => mock.restoreAll());
test('postal lookup accepts Indian PIN codes outside the demo cities', async () => {
  mock.method(global, 'fetch', async () => ({ ok: true, json: async () => [{ Status: 'Success', PostOffice: [{ Country: 'India', District: 'Kohima', State: 'Nagaland' }] }] }));
  const result = await postalLocation('797001');
  assert.equal(result.city, 'kohima'); assert.equal(result.country, 'IN'); assert.equal(result.state, 'Nagaland');
});
test('invalid PIN codes and non-Indian locations are rejected', async () => {
  await assert.rejects(postalLocation('000000'), /valid/);
  mock.method(global, 'fetch', async () => ({ ok: true, json: async () => ({ address: { city: 'London', country_code: 'gb' } }) }));
  await assert.rejects(reverseLocation(51.5, 0), /India/);
});
test('a geocoder outage does not block PIN lookup when the postal location is valid', async () => {
  mock.method(global, 'fetch', async url => {
    if (url.includes('nominatim')) throw new Error('Offline');
    return { ok: true, json: async () => [{ Status: 'Success', PostOffice: [{ Country: 'India', District: 'Kochi', State: 'Kerala' }] }] };
  });
  const location = await postalLocation('682002', true);
  assert.equal(location.city, 'kochi'); assert.equal(location.lat, undefined);
});
