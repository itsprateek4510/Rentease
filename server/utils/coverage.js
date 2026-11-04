const norm = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const canonicalCity = value => {
  const name = norm(value);
  if (name.includes('delhi')) return 'delhi';
  if (name.includes('mumbai')) return 'mumbai';
  return ({ bangalore: 'bengaluru', 'bangalore urban': 'bengaluru', 'bengaluru urban': 'bengaluru', gurgaon: 'gurugram', allahabad: 'prayagraj', pondicherry: 'puducherry' })[name] || name;
};
const coordinates = p => p && typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
function validateCoverage(c = { mode: 'city' }) {
  const invalid = () => { throw Object.assign(new Error('Enter valid delivery coverage, including the selected areas or radius'), { status: 400 }); };
  if (!c || typeof c !== 'object') return invalid();
  const mode = c.mode || 'city';
  if (!['city', 'cities', 'states', 'pincodes', 'radius', 'nationwide'].includes(mode)) return invalid();
  const result = { mode };
  if (['cities', 'states', 'pincodes'].includes(mode)) {
    if (!Array.isArray(c[mode]) || !c[mode].length || c[mode].length > 500 || c[mode].some(x => typeof x !== 'string' || !x.trim() || x.length > 100)) return invalid();
    result[mode] = [...new Set(c[mode].map(x => x.trim()))];
    if (mode === 'pincodes' && result.pincodes.some(x => !/^[1-9]\d{5}$/.test(x))) return invalid();
  }
  if (mode === 'radius') {
    if (!coordinates(c.center) || typeof c.radiusKm !== 'number' || !Number.isFinite(c.radiusKm) || c.radiusKm <= 0 || c.radiusKm > 3000) return invalid();
    result.center = { lat: c.center.lat, lng: c.center.lng }; result.radiusKm = c.radiusKm;
  }
  return result;
}
function covers(product, location) {
  if (location.country !== 'IN') return false;
  const c = product.coverage || { mode: 'city' };
  switch (c.mode || 'city') {
    case 'nationwide': return true;
    case 'city': return !!location.city && canonicalCity(product.city) === canonicalCity(location.city);
    case 'cities': return !!location.city && (c.cities || []).some(x => canonicalCity(x) === canonicalCity(location.city));
    case 'states': return !!location.state && (c.states || []).some(x => norm(x) === norm(location.state));
    case 'pincodes': return !!location.pincode && (c.pincodes || []).includes(location.pincode);
    case 'radius': {
      if (!coordinates(location) || !coordinates(c.center) || !(c.radiusKm > 0)) return false;
      const rad = n => n * Math.PI / 180;
      const a = Math.sin(rad(location.lat - c.center.lat) / 2) ** 2 + Math.cos(rad(location.lat)) * Math.cos(rad(c.center.lat)) * Math.sin(rad(location.lng - c.center.lng) / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a))) <= c.radiusKm;
    }
    default: return false;
  }
}
const queryLocation = query => {
  const result = { city: typeof query.city === 'string' ? query.city : '', state: typeof query.state === 'string' ? query.state : '', pincode: typeof query.pincode === 'string' ? query.pincode : '', country: 'IN' };
  if (query.lat !== undefined && query.lng !== undefined && Number.isFinite(Number(query.lat)) && Number.isFinite(Number(query.lng))) Object.assign(result, { lat: Number(query.lat), lng: Number(query.lng) });
  return result;
};
module.exports = { canonicalCity, coordinates, validateCoverage, covers, queryLocation };
