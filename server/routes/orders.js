const router = require('express').Router();
const crypto = require('crypto');
const mongoose = require('mongoose');
const { Order, Product, Package, Payment, User } = require('../models');
const { covers } = require('../utils/coverage');
const locations = require('../utils/location');
const { h, protect, allow } = require('../middleware/auth');
const { rentFor } = require('../utils/pricing');
const { checkCoupon } = require('../utils/coupon');
const { sendMail } = require('../utils/mailer');
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const restock = async (o, session) => { for (const i of o.items) await Product.updateOne({ _id: i.product }, { $inc: { available: i.qty, __v: 1 } }, { session }); };
const fail = (m, status = 400) => Object.assign(new Error(m), { status });
const txn = () => 'TXN' + crypto.randomBytes(5).toString('hex').toUpperCase();
const METHODS = ['upi', 'card', 'netbanking', 'cod'];

// Place order (checkout). Payment is a demo gateway: online methods succeed instantly, COD is collected on delivery.
router.post('/', protect, allow('user'), h(async (req, res) => {
  const { items, address, city, pincode, deliveryDate, couponCode } = req.body;
  const method = METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'upi';
  if (process.env.NODE_ENV === 'production' && method !== 'cod') throw fail('Online payments are not configured. Please choose pay on delivery.', 503);
  if (!Array.isArray(items) || !items.length || items.length > 100 || typeof address !== 'string' || !address.trim() || typeof city !== 'string' || !city.trim() || !deliveryDate) throw fail('Items, address, city and delivery date are required');
  if (!Number.isFinite(Date.parse(deliveryDate)) || new Date(deliveryDate) < new Date(new Date().toDateString())) throw fail('Choose a valid delivery date that is not in the past');
  if (!/^[1-9]\d{5}$/.test(pincode)) throw fail('Enter a valid Indian PIN code');
  if (items.some(i => !i || !mongoose.isValidObjectId(i.product) || !Number.isSafeInteger(i.qty) || i.qty < 1 || i.qty > 100 || !Number.isInteger(i.tenure))) throw fail('Quantities and tenures must be valid whole numbers');
  if (new Set(items.map(i => i.product)).size !== items.length) throw fail('Combine duplicate cart items before checkout');
  const checkoutKey = req.get('Idempotency-Key');
  if (checkoutKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(checkoutKey)) throw fail('Invalid checkout idempotency key');
  const checkoutHash = crypto.createHash('sha256').update(JSON.stringify({ items, address, city, pincode, deliveryDate, couponCode, method, useCredits: !!req.body.useCredits })).digest('hex');
  const previous = async session => {
    const existing = checkoutKey && await Order.findOne({ user: req.user._id, checkoutKey }).session(session || null);
    if (existing && existing.checkoutHash !== checkoutHash) throw fail('This checkout key was already used for a different order', 409);
    return existing;
  };
  const existing = await previous();
  if (existing) return res.json(existing);
  const products = await Product.find({ _id: { $in: items.map(i => i.product) } });
  const location = await locations.postalLocation(pincode, products.some(p => p.coverage?.mode === 'radius'));
  let reused = false;
  const order = await mongoose.connection.transaction(async session => {
    const existing = await previous(session);
    if (existing) { reused = true; return existing; }
    const built = []; let coupon = null;
    for (const it of items) {
      const { qty, tenure } = it;
      const p = await Product.findById(it.product).session(session);
      if (!p) throw fail('A product in your cart no longer exists');
      if (!covers(p, location)) throw fail(`${p.name}: the lender does not deliver to PIN ${pincode}`);
      if (built.length && String(built[0].vendor) !== String(p.vendor)) throw fail('Please check out products from one lender at a time');
      const lender = await User.findOne({ _id: p.vendor, active: true }).session(session);
      if (!lender) throw fail('This lender is currently unavailable');
      if (!p.tenureOptions.includes(tenure)) throw fail(`Invalid tenure for ${p.name}`);
      const ok = await Product.findOneAndUpdate({ _id: p._id, available: { $gte: qty } }, { $inc: { available: -qty, __v: 1 } }, { session });
      if (!ok) throw fail(`${p.name} is out of stock`);
      built.push({ product: p._id, sku: p.sku, name: p.name, vendor: p.vendor, qty, monthlyRent: rentFor(p.monthlyRent, tenure), deposit: p.securityDeposit, tenure, bundle: it.bundle || undefined });
    }
    for (const slug of [...new Set(built.map(i => i.bundle).filter(Boolean))]) { // package discount only if every item of the package is in the cart
      const pkg = await Package.findOne({ slug }).session(session);
      const ok = pkg && pkg.skus.every(s => built.some(i => i.bundle === slug && i.sku === s));
      built.forEach(i => { if (i.bundle !== slug) return; if (ok && pkg.skus.includes(i.sku)) i.monthlyRent = Math.round(i.monthlyRent * (100 - pkg.discountPercent) / 100); else i.bundle = undefined; });
    }
    const totalMonthly = built.reduce((s, i) => s + i.monthlyRent * i.qty, 0);
    const totalDeposit = built.reduce((s, i) => s + i.deposit * i.qty, 0);
    if (couponCode) coupon = await checkCoupon(couponCode, totalMonthly);
  const discount = coupon?.discount || 0, paid = method !== 'cod';
  const owner = await User.findById(req.user._id).session(session);
  const credit = req.body.useCredits ? Math.max(0, Math.min(owner.credits || 0, totalMonthly - discount)) : 0;
  const [order] = await Order.create([{
    user: req.user._id, checkoutKey, checkoutHash, items: built, address, city: location.city, state: location.state, pincode, deliveryDate,
    endDate: addMonths(deliveryDate, Math.max(...built.map(i => i.tenure))),
    totalMonthly, totalDeposit, discount, couponCode: coupon?.code, creditsUsed: credit, payable: totalMonthly + totalDeposit - discount - credit,
    paymentMethod: method, paymentStatus: paid ? 'paid' : 'pending', paidMonths: paid ? 1 : 0
  }], { session });
  await Payment.create([{ user: req.user._id, order: order._id, amount: order.payable, type: 'initial', method, status: paid ? 'paid' : 'pending', txnId: paid ? txn() : undefined, paidAt: paid ? new Date() : undefined }], { session });
  if (credit) { owner.credits -= credit; await owner.save({ session }); }
  return order;
  }).catch(async e => {
    if (e.code === 11000 && checkoutKey) { const existing = await previous(); if (existing) { reused = true; return existing; } }
    throw e;
  });
  if (!reused && req.user.email) sendMail(req.user.email, 'Your RentEase order is placed', `Hi ${req.user.name}, your order #${String(order._id).slice(-6).toUpperCase()} is confirmed. Amount: ₹${order.payable}.`).catch(() => {});
  res.status(reused ? 200 : 201).json(order);
}));

router.get('/mine', protect, h(async (req, res) => res.json(await Order.find({ user: req.user._id }).sort('-createdAt'))));
router.get('/manage/list', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const f = req.user.role === 'admin' ? {} : { 'items.vendor': req.user._id };
  res.json(await Order.find(f).populate('user', 'name email phone kyc').sort('-createdAt'));
}));
router.get('/:id', protect, h(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o || (String(o.user) !== String(req.user._id) && req.user.role !== 'admin')) throw fail('Order not found', 404);
  res.json(o);
}));

const mine = async (req, session = null) => {
  const o = await Order.findById(req.params.id).session(session);
  if (!o || String(o.user) !== String(req.user._id)) throw fail('Order not found', 404);
  return o;
};
router.put('/:id/extend', protect, h(async (req, res) => {
  const o = await mine(req), m = Number(req.body.months);
  if (o.status !== 'active') throw fail('Only active rentals can be extended');
  if (!Number.isInteger(m) || !(m >= 1 && m <= 12)) throw fail('Choose 1 to 12 whole months');
  o.items.forEach(i => (i.tenure += m)); o.endDate = addMonths(o.endDate, m);
  await o.save(); res.json(o);
}));
router.put('/:id/pay-rent', protect, h(async (req, res) => {
  if (process.env.NODE_ENV === 'production') throw fail('Online rent payments are not configured. Contact support to record a payment.', 503);
  const result = await mongoose.connection.transaction(async session => {
  const o = await mine(req, session);
  if (!['active', 'return_requested'].includes(o.status)) throw fail('Rent can be paid for active rentals only');
  if (o.paidMonths >= Math.max(...o.items.map(i => i.tenure))) throw fail('All months are already paid');
  const method = METHODS.includes(req.body.method) && req.body.method !== 'cod' ? req.body.method : 'upi';
  await Payment.create([{ user: req.user._id, order: o._id, amount: o.totalMonthly, type: 'rent', method, status: 'paid', txnId: txn(), paidAt: new Date() }], { session });
  o.paidMonths += 1; await o.save({ session }); return o;
  }); res.json(result);
}));
router.put('/:id/return', protect, h(async (req, res) => {
  const o = await mine(req);
  if (o.status !== 'active') throw fail('Only active rentals can be returned');
  if (!Number.isFinite(Date.parse(req.body.pickupDate)) || new Date(req.body.pickupDate) < new Date(new Date().toDateString())) throw fail('Pick a valid future pickup date');
  o.pickupDate = req.body.pickupDate; o.status = 'return_requested'; await o.save(); res.json(o);
}));
router.put('/:id/cancel', protect, h(async (req, res) => {
  const result = await mongoose.connection.transaction(async session => {
  const o = await mine(req, session);
  if (!['placed', 'scheduled'].includes(o.status)) throw fail('Delivered rentals cannot be cancelled; request a return');
  o.status = 'cancelled'; if (o.paymentStatus === 'paid') o.paymentStatus = 'refunded';
  await Payment.updateMany({ order: o._id, status: { $in: ['paid', 'pending'] } }, { status: 'refunded' }, { session });
  if (o.creditsUsed) await User.updateOne({ _id: o.user }, { $inc: { credits: o.creditsUsed } }, { session });
  await o.save({ session }); await restock(o, session); return o;
  }); res.json(result);
}));

// Vendor/Admin: delivery & return flow, damage recording
const flow = { placed: ['scheduled'], scheduled: ['active'], active: ['returned', 'damaged'], return_requested: ['returned', 'damaged'] };
router.put('/:id/status', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const result = await mongoose.connection.transaction(async session => {
  const o = await Order.findById(req.params.id).session(session);
  if (!o) throw fail('Order not found', 404);
  if (req.user.role !== 'admin' && !o.items.some(i => String(i.vendor) === String(req.user._id))) throw fail('Not your order', 403);
  if (req.user.role !== 'admin' && o.items.some(i => String(i.vendor) !== String(req.user._id))) throw fail('An admin must manage this legacy multi-lender order', 403);
  const { status, damageCharge } = req.body;
  if (!(flow[o.status] || []).includes(status)) throw fail(`Cannot go from ${o.status} to ${status}`);
  if (status === 'scheduled') {
    const owner = await User.findById(o.user).session(session);
    if (owner?.kyc?.status !== 'verified') throw fail('Customer KYC is not verified yet. Ask admin to verify it first.');
  }
  if (status === 'damaged') {
    if (!Number.isFinite(Number(damageCharge)) || Number(damageCharge) < 0) throw fail('Enter a non-negative damage charge');
    o.damageCharge = Math.min(Number(damageCharge), o.totalDeposit);
  }
  if (status === 'active' && o.paymentStatus === 'pending') { // cash collected on delivery
    o.paymentStatus = 'paid'; o.paidMonths = 1;
    await Payment.updateMany({ order: o._id, status: 'pending' }, { status: 'paid', paidAt: new Date(), txnId: txn() }, { session });
  }
  o.status = status; await o.save({ session });
  if (status === 'returned' || status === 'damaged') await restock(o, session);
  return o;
  }); res.json(result);
}));
module.exports = router;
