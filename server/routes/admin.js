const router = require('express').Router();
const { User, Order, Product, Maintenance, Dispute, Area, Payment, Contact, ServiceRequest } = require('../models');
const { h, protect, allow } = require('../middleware/auth');
const admin = [protect, allow('admin')];

// Service areas (public read, admin manage)
router.get('/areas', h(async (req, res) => res.json(await Area.find({ active: true }).sort('name'))));
router.post('/areas', ...admin, h(async (req, res) => res.status(201).json(await Area.create({ name: req.body.name, lat: req.body.lat, lng: req.body.lng }))));
router.delete('/areas/:id', ...admin, h(async (req, res) => { await Area.findByIdAndDelete(req.params.id); res.json({ ok: true }); }));

// Disputes & damage claims
router.post('/disputes', protect, h(async (req, res) => {
  const o = await Order.findOne({ _id: req.body.order, user: req.user._id });
  if (!o || !req.body.message) return res.status(400).json({ message: 'Order and message are required' });
  res.status(201).json(await Dispute.create({ user: req.user._id, order: o._id, message: req.body.message, type: req.body.type }));
}));
router.get('/disputes/mine', protect, h(async (req, res) => res.json(await Dispute.find({ user: req.user._id }).sort('-createdAt'))));
router.get('/disputes', ...admin, h(async (req, res) => res.json(await Dispute.find().populate('user', 'name email').sort('-createdAt'))));
router.put('/disputes/:id', ...admin, h(async (req, res) =>
  res.json(await Dispute.findByIdAndUpdate(req.params.id, { status: req.body.status, resolution: req.body.resolution }, { new: true }))));

// Users
router.get('/admin/users', ...admin, h(async (req, res) => res.json(await User.find().select('-password -otpHash -resetToken').sort('-createdAt'))));
router.put('/admin/users/:id/toggle', ...admin, h(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ message: 'User not found' });
  if (u.role === 'admin') return res.status(400).json({ message: 'Cannot deactivate an admin' });
  u.active = !u.active; await u.save(); res.json({ _id: u._id, active: u.active });
}));

// Reports & KPIs
router.get('/admin/reports', ...admin, h(async (req, res) => {
  const [active, orders, products, maint, perUser, damaged] = await Promise.all([
    Order.find({ status: 'active' }), Order.countDocuments(), Product.find(), Maintenance.find({ status: 'resolved' }),
    Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: '$user', n: { $sum: 1 } } }]),
    Order.find({ status: 'damaged' })
  ]);
  const stock = products.reduce((s, p) => s + p.stock, 0), out = products.reduce((s, p) => s + (p.stock - p.available), 0);
  const hrs = maint.map(m => (m.resolvedAt - m.createdAt) / 36e5);
  res.json({
    activeRentals: active.length, totalOrders: orders,
    mrr: active.reduce((s, o) => s + o.totalMonthly, 0),
    utilizationRate: stock ? +(out / stock * 100).toFixed(1) : 0,
    retentionRate: perUser.length ? +(perUser.filter(u => u.n > 1).length / perUser.length * 100).toFixed(1) : 0,
    avgMaintenanceHours: hrs.length ? +(hrs.reduce((a, b) => a + b, 0) / hrs.length).toFixed(1) : 0,
    openMaintenance: await Maintenance.countDocuments({ status: { $ne: 'resolved' } }),
    revenue: (await Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]))[0]?.t || 0,
    pendingKyc: await User.countDocuments({ 'kyc.status': 'pending' }), newMessages: await Contact.countDocuments({ status: 'new' }), newRequests: await ServiceRequest.countDocuments({ status: 'new' }),
    openDisputes: await Dispute.countDocuments({ status: 'open' }),
    damageRevenue: damaged.reduce((s, o) => s + o.damageCharge, 0),
    totalUsers: await User.countDocuments({ role: 'user' }), totalProducts: products.length
  });
}));
module.exports = router;
