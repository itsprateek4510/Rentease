const router = require('express').Router();
const { Product } = require('../models');
const { h, protect, allow } = require('../middleware/auth');
const { esc, cityRx } = require('../utils/pricing');
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const SORT = { low: 'monthlyRent', high: '-monthlyRent', rating: '-ratingAvg -ratingCount', new: '-createdAt' };

router.get('/', h(async (req, res) => {
  const { category, city, q, type, sku, sort } = req.query, f = {};
  if (category) f.category = category;
  if (type) f.type = type;
  if (sku) f.sku = sku;
  if (city) f.city = cityRx(city);
  if (q) f.name = new RegExp(esc(q), 'i');
  res.json(await Product.find(f).sort(SORT[sort] || '-ratingCount -createdAt').limit(600));
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
  const b = req.body;
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
  const b = { ...req.body }; ['vendor', 'available', 'ratingAvg', 'ratingCount', '_id', 'similar'].forEach(k => delete b[k]);
  if (b.stock !== undefined) p.available = Math.max(0, p.available + Number(b.stock) - p.stock);
  Object.assign(p, b); await p.save(); res.json(p);
}));
router.delete('/:id', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const p = await owned(req, res); if (!p) return;
  await p.deleteOne(); res.json({ ok: true });
}));
module.exports = router;
