const router = require('express').Router();
const crypto = require('crypto');
const { Order, Product, Area, Package, Payment, User } = require('../models');
const { h, protect, allow } = require('../middleware/auth');
const { rentFor } = require('../utils/pricing');
const { checkCoupon } = require('../utils/coupon');
const { sendMail } = require('../utils/mailer');
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const restock = o => Promise.all(o.items.map(i => Product.updateOne({ _id: i.product }, { $inc: { available: i.qty } })));
const fail = (m, status = 400) => Object.assign(new Error(m), { status });
const txn = () => 'TXN' + crypto.randomBytes(5).toString('hex').toUpperCase();
const METHODS = ['upi', 'card', 'netbanking', 'cod'];

// Place order (checkout). Payment is a demo gateway: online methods succeed instantly, COD is collected on delivery.
router.post('/', protect, h(async (req, res) => {
  const { items, address, city, pincode, deliveryDate, couponCode } = req.body;
  const method = METHODS.includes(req.body.paymentMethod) ? req.body.paymentMethod : 'upi';
  if (!items?.length || !address || !city || !deliveryDate) throw fail('Items, address, city and delivery date are required');
  if (new Date(deliveryDate) < new Date(new Date().toDateString())) throw fail('Delivery date cannot be in the past');
  const cityKey = city.trim().toLowerCase();
  if (await Area.countDocuments() && !(await Area.findOne({ name: cityKey, active: true }))) throw fail('We do not serve ' + city + ' yet');
  const built = [], reserved = []; let coupon = null, totalMonthly = 0, totalDeposit = 0;
  try {
    for (const it of items) {
      const qty = Math.max(1, Number(it.qty) || 1), tenure = Number(it.tenure);
      const p = await Product.findById(it.product);
      if (!p) throw fail('A product in your cart no longer exists');
      if (String(p.city).toLowerCase() !== cityKey) throw fail(`${p.name} is not available in ${city}`);
      if (!p.tenureOptions.includes(tenure)) throw fail(`Invalid tenure for ${p.name}`);
      const ok = await Product.findOneAndUpdate({ _id: p._id, available: { $gte: qty } }, { $inc: { available: -qty } });
      if (!ok) throw fail(`${p.name} is out of stock`);
      reserved.push({ product: p._id, qty });
      built.push({ product: p._id, sku: p.sku, name: p.name, vendor: p.vendor, qty, monthlyRent: rentFor(p.monthlyRent, tenure), deposit: p.securityDeposit, tenure, bundle: it.bundle || undefined });
    }
    for (const slug of [...new Set(built.map(i => i.bundle).filter(Boolean))]) { // package discount only if every item of the package is in the cart
      const pkg = await Package.findOne({ slug });
      const ok = pkg && pkg.skus.every(s => built.some(i => i.bundle === slug && i.sku === s));
      built.forEach(i => { if (i.bundle !== slug) return; if (ok && pkg.skus.includes(i.sku)) i.monthlyRent = Math.round(i.monthlyRent * (100 - pkg.discountPercent) / 100); else i.bundle = undefined; });
    }
    totalMonthly = built.reduce((s, i) => s + i.monthlyRent * i.qty, 0);
    totalDeposit = built.reduce((s, i) => s + i.deposit * i.qty, 0);
    if (couponCode) coupon = await checkCoupon(couponCode, totalMonthly);
  } catch (e) {
    await Promise.all(reserved.map(r => Product.updateOne({ _id: r.product }, { $inc: { available: r.qty } })));
    throw e;
  }
  const discount = coupon?.discount || 0, paid = method !== 'cod';
  const credit = req.body.useCredits ? Math.max(0, Math.min((await User.findById(req.user._id)).credits || 0, totalMonthly - discount)) : 0;
  const order = await Order.create({
    user: req.user._id, items: built, address, city: cityKey, pincode, deliveryDate,
    endDate: addMonths(deliveryDate, Math.max(...built.map(i => i.tenure))),
    totalMonthly, totalDeposit, discount, couponCode: coupon?.code, creditsUsed: credit, payable: totalMonthly + totalDeposit - discount - credit,
    paymentMethod: method, paymentStatus: paid ? 'paid' : 'pending', paidMonths: paid ? 1 : 0
  });
  await Payment.create({ user: req.user._id, order: order._id, amount: order.payable, type: 'initial', method, status: paid ? 'paid' : 'pending', txnId: paid ? txn() : undefined, paidAt: paid ? new Date() : undefined });
  if (credit) await User.updateOne({ _id: req.user._id }, { $inc: { credits: -credit } });
  if (req.user.email) sendMail(req.user.email, 'Your RentEase order is placed', `Hi ${req.user.name}, your order #${String(order._id).slice(-6).toUpperCase()} is confirmed. Amount ${paid ? 'paid' : 'payable on delivery'}: ₹${order.payable}.`).catch(() => {});
  res.status(201).json(order);
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

const mine = async req => {
  const o = await Order.findById(req.params.id);
  if (!o || String(o.user) !== String(req.user._id)) throw fail('Order not found', 404);
  return o;
};
router.put('/:id/extend', protect, h(async (req, res) => {
  const o = await mine(req), m = Number(req.body.months);
  if (o.status !== 'active') throw fail('Only active rentals can be extended');
  if (!(m >= 1 && m <= 12)) throw fail('Choose 1 to 12 months');
  o.items.forEach(i => (i.tenure += m)); o.endDate = addMonths(o.endDate, m);
  await o.save(); res.json(o);
}));
router.put('/:id/pay-rent', protect, h(async (req, res) => {
  const o = await mine(req);
  if (!['active', 'return_requested'].includes(o.status)) throw fail('Rent can be paid for active rentals only');
  if (o.paidMonths >= Math.max(...o.items.map(i => i.tenure))) throw fail('All months are already paid');
  const method = METHODS.includes(req.body.method) && req.body.method !== 'cod' ? req.body.method : 'upi';
  await Payment.create({ user: req.user._id, order: o._id, amount: o.totalMonthly, type: 'rent', method, status: 'paid', txnId: txn(), paidAt: new Date() });
  o.paidMonths += 1; await o.save(); res.json(o);
}));
router.put('/:id/return', protect, h(async (req, res) => {
  const o = await mine(req);
  if (o.status !== 'active') throw fail('Only active rentals can be returned');
  if (!req.body.pickupDate) throw fail('Pick a pickup date');
  o.pickupDate = req.body.pickupDate; o.status = 'return_requested'; await o.save(); res.json(o);
}));
router.put('/:id/cancel', protect, h(async (req, res) => {
  const o = await mine(req);
  if (!['placed', 'scheduled'].includes(o.status)) throw fail('Delivered rentals cannot be cancelled; request a return');
  o.status = 'cancelled'; if (o.paymentStatus === 'paid') { o.paymentStatus = 'refunded'; await Payment.updateMany({ order: o._id, status: 'paid' }, { status: 'refunded' }); }
  if (o.creditsUsed) await User.updateOne({ _id: o.user }, { $inc: { credits: o.creditsUsed } });
  await o.save(); await restock(o); res.json(o);
}));

// Vendor/Admin: delivery & return flow, damage recording
const flow = { placed: ['scheduled'], scheduled: ['active'], active: ['returned', 'damaged'], return_requested: ['returned', 'damaged'] };
router.put('/:id/status', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const o = await Order.findById(req.params.id);
  if (!o) throw fail('Order not found', 404);
  if (req.user.role !== 'admin' && !o.items.some(i => String(i.vendor) === String(req.user._id))) throw fail('Not your order', 403);
  const { status, damageCharge } = req.body;
  if (!(flow[o.status] || []).includes(status)) throw fail(`Cannot go from ${o.status} to ${status}`);
  if (status === 'scheduled') {
    const owner = await User.findById(o.user);
    if (owner?.kyc?.status !== 'verified') throw fail('Customer KYC is not verified yet. Ask admin to verify it first.');
  }
  if (status === 'damaged') o.damageCharge = Math.min(Number(damageCharge) || 0, o.totalDeposit);
  if (status === 'active' && o.paymentStatus === 'pending') { // cash collected on delivery
    o.paymentStatus = 'paid'; o.paidMonths = 1;
    await Payment.updateMany({ order: o._id, status: 'pending' }, { status: 'paid', paidAt: new Date(), txnId: txn() });
  }
  o.status = status; await o.save();
  if (status === 'returned' || status === 'damaged') await restock(o);
  res.json(o);
}));
module.exports = router;
