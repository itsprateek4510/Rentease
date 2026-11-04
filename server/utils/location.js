const { canonicalCity, coordinates } = require('./coverage');
const cache = new Map();
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
async function json(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'RentEase/1.0 (India rental delivery lookup)' } });
    if (!r.ok) throw new Error('Location provider unavailable');
    return await r.json();
  } catch { throw fail('Location lookup is temporarily unavailable. Please try again.', 503); }
}
async function postalLocation(pincode, withCoordinates = false) {
  if (typeof pincode !== 'string' || !/^[1-9]\d{5}$/.test(pincode)) throw fail('Enter a valid six-digit Indian PIN code');
  const key = pincode + (withCoordinates ? ':coordinates' : ''), saved = cache.get(key);
  if (saved && saved.expires > Date.now()) return saved.value;
  const data = await json('https://api.postalpincode.in/pincode/' + pincode);
  const office = data?.[0]?.Status === 'Success' && data[0].PostOffice?.[0];
  if (!office || office.Country !== 'India') throw fail('That Indian PIN code was not found');
  const value = { city: canonicalCity(office.District), state: office.State, pincode, country: 'IN' };
  if (withCoordinates) {
    try {
    const points = await json('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&country=India&postalcode=' + pincode + '&limit=1');
    const point = points?.[0];
    if (!point || !coordinates({ lat: Number(point.lat), lng: Number(point.lon) })) throw fail('We cannot verify distance for this PIN code. Choose another listing or contact the lender.', 503);
    value.lat = Number(point.lat); value.lng = Number(point.lon);
    } catch { /* PIN lookup remains useful; radius coverage fails closed without coordinates. */ }
  }
  if (cache.size >= 1000) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expires: Date.now() + 3600e3 });
  return value;
}
async function reverseLocation(lat, lng) {
  if (!coordinates({ lat, lng })) throw fail('Invalid location coordinates');
  const data = await json(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`);
  if (data.address?.country_code !== 'in') throw fail('Please choose a delivery location in India');
  const a = data.address, city = a.city || a.town || a.village || a.county || a.state_district;
  if (!city || !a.state) throw fail('Could not identify your city. Enter your Indian PIN code instead.');
  return { city: canonicalCity(city), state: a.state, pincode: /^[1-9]\d{5}$/.test(a.postcode) ? a.postcode : '', lat, lng, country: 'IN' };
}
module.exports = { postalLocation, reverseLocation };
