const { test } = require('node:test');
const assert = require('node:assert/strict');
const { covers, validateCoverage, canonicalCity } = require('../utils/coverage');

test('legacy products stay local; nationwide products reach any Indian location', () => {
  assert.equal(covers({ city: 'Delhi' }, { city: 'delhi', country: 'IN' }), true);
  assert.equal(covers({ city: 'Delhi' }, { city: 'Pune', country: 'IN' }), false);
  assert.equal(covers({ city: 'Delhi', coverage: { mode: 'nationwide' } }, { city: 'Kochi', country: 'IN' }), true);
  assert.equal(covers({ coverage: { mode: 'nationwide' } }, { country: 'US' }), false);
  assert.equal(canonicalCity('Bangalore'), canonicalCity('Bengaluru'));
});
test('lenders can restrict by city, state, PIN code, or radius in kilometres', () => {
  assert.equal(covers({ coverage: { mode: 'cities', cities: ['Bengaluru'] } }, { city: 'Bangalore', country: 'IN' }), true);
  assert.equal(covers({ coverage: { mode: 'states', states: ['Kerala'] } }, { state: 'kerala', country: 'IN' }), true);
  assert.equal(covers({ coverage: { mode: 'pincodes', pincodes: ['110001'] } }, { pincode: '110002', country: 'IN' }), false);
  const p = { coverage: { mode: 'radius', center: { lat: 28.61, lng: 77.21 }, radiusKm: 20 } };
  assert.equal(covers(p, { lat: 28.62, lng: 77.22, country: 'IN' }), true);
  assert.equal(covers(p, { lat: 19.08, lng: 72.88, country: 'IN' }), false);
  assert.equal(covers(p, { city: 'Delhi', country: 'IN' }), false);
});
test('invalid, empty and malformed coverage fails closed', () => {
  for (const c of [{ mode: 'other' }, { mode: 'states', states: [] }, { mode: 'radius', radiusKm: -1 }, { mode: 'pincodes', pincodes: ['000000'] }]) {
    assert.throws(() => validateCoverage(c));
  }
  assert.equal(covers({ coverage: { mode: 'other' } }, { country: 'IN' }), false);
  assert.equal(covers({ coverage: { mode: 'nationwide' } }, {}), false);
});
