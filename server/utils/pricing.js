// Monthly rent gets cheaper on longer tenures. monthlyRent on a product is its 3-month price.
const MULT = { 1: 1.25, 3: 1, 6: 0.92, 9: 0.86, 12: 0.8 };
const rentFor = (base, tenure) => Math.round(base * (MULT[tenure] ?? 1));
const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const cityRx = c => new RegExp('^' + esc(c) + '$', 'i');
module.exports = { MULT, rentFor, esc, cityRx };
