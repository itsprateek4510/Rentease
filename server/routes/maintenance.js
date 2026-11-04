const router = require('express').Router();
const { Maintenance, Order } = require('../models');
const { h, protect, allow } = require('../middleware/auth');

router.post('/', protect, h(async (req, res) => {
  const { order, description } = req.body;
  const o = await Order.findOne({ _id: order, user: req.user._id });
  if (!o || o.status !== 'active') return res.status(400).json({ message: 'Maintenance is available for active rentals only' });
  if (!description) return res.status(400).json({ message: 'Describe the problem' });
  res.status(201).json(await Maintenance.create({ user: req.user._id, order, description, vendor: o.items[0].vendor }));
}));
router.get('/mine', protect, h(async (req, res) => res.json(await Maintenance.find({ user: req.user._id }).sort('-createdAt'))));
router.get('/manage/list', protect, allow('vendor', 'admin'), h(async (req, res) =>
  res.json(await Maintenance.find(req.user.role === 'admin' ? {} : { vendor: req.user._id })
    .populate('user', 'name phone').populate('order', 'items address').sort('-createdAt'))));
router.put('/:id', protect, allow('vendor', 'admin'), h(async (req, res) => {
  const m = await Maintenance.findById(req.params.id);
  if (!m) return res.status(404).json({ message: 'Request not found' });
  if (req.user.role !== 'admin' && String(m.vendor) !== String(req.user._id)) return res.status(403).json({ message: 'Not your request' });
  m.status = req.body.status; if (m.status === 'resolved') m.resolvedAt = new Date();
  await m.save(); res.json(m);
}));
module.exports = router;
