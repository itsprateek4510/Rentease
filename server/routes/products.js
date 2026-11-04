const router = require('express').Router();
const { Product } = require('../models');
const { h, protect, allow } = require('../middleware/auth');
const { esc, cityRx } = require('../utils/pricing');
const { covers, queryLocation, validateCoverage } = require('../utils/coverage');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SORT = { low: 'monthlyRent', high: '-monthlyRent', rating: '-ratingAvg -ratingCount', new: '-createdAt' };

router.get('/', h(async (req, res) => {
  const { category, city, q, type, sku, sort } = req.query, f = {};
  if (category) f.category = category;
  if (type) f.type = type;
  if (sku) f.sku = sku;
  if (q) f.name = new RegExp(esc(q), 'i');
  const products = await Product.find(f).sort(SORT[sort] || '-ratingCount -createdAt');
  const location = queryLocation(req.query);
  res.json(products.filter(p => !city || covers(p, location)).slice(0, 600));
}));
router.get('/mine/list', protect, allow('vendor', 'admin'), h(async (req, res) =>
  res.json(await Product.find(req.user.role === 'admin' ? {} : { vendor: req.user._id }).sort('-createdAt').limit(600))));
router.get('/:id', h(async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) return res.status(404).json({ message: 'Product not found' });
  const similar = await Product.find({ city: p.city, category: p.category, _id: { $ne: p._id } }).sort('-ratingCount').limit(4);
  res.json({ ...p.toObject(), similar });
}));
router.post('/', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const b = productInput(req.body);
  res.status(201).json(await Product.create({ ...b, sku: b.sku || slug(b.name), vendor: req.user._id, available: b.stock ?? 1 }));
}));
const owned = async (req, res) => {
  const p = await Product.findById(req.params.id);
  if (!p) { res.status(404).json({ message: 'Product not found' }); return null; }
  if (req.user.role !== 'admin' && String(p.vendor) !== String(req.user._id)) { res.status(403).json({ message: 'Not your product' }); return null; }
  return p;
};
router.put('/:id', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  const b = productInput({ ...p.toObject(), ...req.body });
  if (b.stock < p.stock - p.available) return res.status(400).json({ message: 'Stock cannot be less than the number currently rented' });
  if (b.stock !== undefined) p.available += b.stock - p.stock;
  Object.assign(p, b); await p.save(); res.json(p);
}));
router.delete('/:id', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  if (p.available < p.stock) return res.status(400).json({ message: 'Cannot delete a product while units are rented' });
  const deleted = await Product.deleteOne({ _id: p._id, available: p.stock, __v: p.__v });
  if (!deleted.deletedCount) return res.status(409).json({ message: 'Product inventory changed. Please reload and try again.' });
  res.json({ ok: true });
}));
module.exports = router;

function productInput(body) {
  const keys = ['name', 'category', 'type', 'brand', 'capacity', 'description', 'image', 'monthlyRent', 'securityDeposit', 'tenureOptions', 'stock', 'city', 'sku'];
  const b = Object.fromEntries(keys.filter(k => body[k] !== undefined).map(k => [k, body[k]]));
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  if (typeof b.name !== 'string' || !b.name.trim() || typeof b.city !== 'string' || !b.city.trim()) invalid('Product name and origin city are required');
  if (!Number.isFinite(b.monthlyRent) || b.monthlyRent < 1 || (b.securityDeposit !== undefined && (!Number.isFinite(b.securityDeposit) || b.securityDeposit < 0))) invalid('Rent and deposit must be valid non-negative amounts');
  if (b.stock !== undefined && (!Number.isSafeInteger(b.stock) || b.stock < 0)) invalid('Stock must be a non-negative whole number');
  if (b.tenureOptions !== undefined && (!Array.isArray(b.tenureOptions) || !b.tenureOptions.length || b.tenureOptions.some(t => !Number.isInteger(t) || t < 1 || t > 12))) invalid('Tenures must be whole months between 1 and 12');
  b.coverage = validateCoverage(body.coverage);
  return b;
}
