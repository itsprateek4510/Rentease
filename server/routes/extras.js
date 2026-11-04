const router = require('express').Router();
const { User, Product, Order, Payment, Coupon, Package, Review, Contact, Store, ServiceRequest } = require('../models');
const { h, protect, allow, limit } = require('../middleware/auth');
const { rentFor, cityRx } = require('../utils/pricing');
const { checkCoupon } = require('../utils/coupon');
const { covers, queryLocation } = require('../utils/coverage');
const admin = [protect, allow('admin')];

// ---- Wishlist
router.get('/wishlist', protect, h(async (req, res) => res.json(await Product.find({ _id: { $in: req.user.wishlist } }))));
router.post('/wishlist/:id', protect, h(async (req, res) => {
  const u = await User.findById(req.user._id), i = u.wishlist.findIndex(x => String(x) === req.params.id);
  if (i >= 0) u.wishlist.splice(i, 1); else u.wishlist.push(req.params.id);
  await u.save(); res.json(u.wishlist.map(String));
}));

// ---- Saved addresses & KYC
router.post('/addresses', protect, h(async (req, res) => {
  const { label, line, city, state, pincode } = req.body;
  if (!line || !city || !/^[1-9]\d{5}$/.test(pincode)) return res.status(400).json({ message: 'Address, city and a valid Indian PIN code are required' });
  const u = await User.findById(req.user._id); u.addresses.push({ label: label || 'Home', line, city, state, pincode }); await u.save();
  res.status(201).json(u.addresses);
}));
router.delete('/addresses/:id', protect, h(async (req, res) => {
  const u = await User.findById(req.user._id); u.addresses.pull(req.params.id); await u.save(); res.json(u.addresses);
}));
router.put('/kyc', protect, h(async (req, res) => {
  const { docType, docNumber } = req.body;
  if (!['aadhaar', 'pan', 'passport', 'driving licence'].includes(docType) || String(docNumber || '').length < 6) return res.status(400).json({ message: 'Choose a document type and enter a valid number' });
  const u = await User.findById(req.user._id);
  u.kyc = { status: 'pending', docType, docNumber: 'XXXX' + String(docNumber).slice(-4), submittedAt: new Date() }; await u.save(); // only last 4 digits are stored
  res.json(u.kyc);
}));
router.put('/admin/users/:id/kyc', ...admin, h(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  u.kyc.status = req.body.status; u.kyc.note = req.body.note; await u.save(); res.json(u.kyc);
}));

// ---- Payments ledger
router.get('/payments/mine', protect, h(async (req, res) => res.json(await Payment.find({ user: req.user._id }).sort('-createdAt'))));

// ---- Coupons
router.get('/coupons', h(async (req, res) => res.json(await Coupon.find({ active: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).sort('minOrder'))));
router.post('/coupons/validate', h(async (req, res) => res.json(await checkCoupon(req.body.code, Number(req.body.subtotal) || 0))));
router.get('/admin/coupons', ...admin, h(async (req, res) => res.json(await Coupon.find().sort('-createdAt'))));
router.post('/admin/coupons', ...admin, h(async (req, res) => res.status(201).json(await Coupon.create(req.body))));
router.put('/admin/coupons/:id', ...admin, h(async (req, res) => res.json(await Coupon.findByIdAndUpdate(req.params.id, req.body, { new: true }))));
router.delete('/admin/coupons/:id', ...admin, h(async (req, res) => { await Coupon.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// ---- Home packages (bundles resolved to the products available in a city)
router.get('/packages', h(async (req, res) => {
  const pk = await Package.find({ kind: req.query.kind === 'plan' ? 'plan' : 'package' }).sort('createdAt'), city = (req.query.city || '').trim();
  const f = { sku: { $in: [...new Set(pk.flatMap(p => p.skus))] } };
  const prods = (await Product.find(f)).filter(p => (!city || covers(p, queryLocation(req.query))) && p.available > 0);
  res.json(pk.map(p => {
    // Keep packages within one lender so another lender cannot control their orders.
    const groups = [...new Set(prods.map(x => String(x.vendor)))].map(v => p.skus.map(s => prods.find(x => x.sku === s && String(x.vendor) === v)).filter(Boolean));
    const items = groups.sort((a, b) => b.length - a.length)[0] || [];
    const originalRent = items.reduce((s, x) => s + rentFor(x.monthlyRent, 6), 0);
    const rent = items.reduce((s, x) => s + Math.round(rentFor(x.monthlyRent, 6) * (100 - p.discountPercent) / 100), 0);
    return { ...p.toObject(), items, available: items.length === p.skus.length, originalRent, rent, deposit: items.reduce((s, x) => s + x.securityDeposit, 0) };
  }));
}));

// ---- Reviews (only people who rented the product can review it)
router.get('/reviews', h(async (req, res) => res.json(await Review.find({ sku: req.query.sku }).sort('-createdAt').limit(50))));
router.post('/reviews', protect, h(async (req, res) => {
  const { sku, comment } = req.body, rating = Number(req.body.rating);
  if (!sku || !(rating >= 1 && rating <= 5)) return res.status(400).json({ message: 'Choose a rating from 1 to 5' });
  const had = await Order.exists({ user: req.user._id, 'items.sku': sku, status: { $in: ['active', 'return_requested', 'returned', 'damaged'] } });
  if (!had) return res.status(400).json({ message: 'Only customers who have rented this product can review it' });
  await Review.findOneAndUpdate({ sku, user: req.user._id }, { sku, user: req.user._id, userName: req.user.name, rating, comment }, { upsert: true, new: true, setDefaultsOnInsert: true });
  const [a] = await Review.aggregate([{ $match: { sku } }, { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } }]);
  await Product.updateMany({ sku }, { ratingAvg: +a.avg.toFixed(1), ratingCount: a.n });
  res.status(201).json({ ok: true });
}));

// ---- Contact form
router.post('/contact', limit(5, 15 * 60e3), h(async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !message || !(email || phone)) return res.status(400).json({ message: 'Name, a way to reach you, and a message are required' });
  await Contact.create({ name, email, phone, message }); res.status(201).json({ message: "Thanks! We'll get back to you within one working day." });
}));
router.get('/admin/messages', ...admin, h(async (req, res) => res.json(await Contact.find().sort('-createdAt'))));
router.put('/admin/messages/:id', ...admin, h(async (req, res) => res.json(await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }))));

// ---- Stores
router.get('/stores', h(async (req, res) => res.json(await Store.find(req.query.city ? { city: cityRx(req.query.city) } : {}).sort('city name'))));

// ---- Relocation and business enquiries
router.post('/requests', limit(6, 15 * 60e3), h(async (req, res) => {
  const { type, name, email, city, details } = req.body, phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);
  if (!['relocation', 'business'].includes(type) || !name || !/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: 'Please enter your name and a valid 10-digit mobile number' });
  await ServiceRequest.create({ type, name, phone, email, city, details }); res.status(201).json({ message: 'Request received! Our team will call you within one working day.' });
}));
router.get('/admin/requests', ...admin, h(async (req, res) => res.json(await ServiceRequest.find().sort('-createdAt'))));
router.put('/admin/requests/:id', ...admin, h(async (req, res) => res.json(await ServiceRequest.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }))));
module.exports = router;
