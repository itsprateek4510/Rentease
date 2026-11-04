const jwt = require('jsonwebtoken');
const { User } = require('../models');
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const protect = h(async (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ message: 'Please log in' });
  try {
    const { id, iat } = jwt.verify(t, process.env.JWT_SECRET);
    const u = await User.findById(id).select('-password');
    if (!u || !u.active) return res.status(401).json({ message: 'Account unavailable' });
    if (u.passwordChangedAt && iat < Math.floor(u.passwordChangedAt.getTime() / 1000)) return res.status(401).json({ message: 'Password changed, log in again' });
    req.user = u; next();
  } catch { res.status(401).json({ message: 'Session expired, log in again' }); }
});
const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Not allowed' });
// simple in-memory rate limiter (use redis-backed limiter if you run several servers)
const hits = new Map();
const limit = (max, ms) => (req, res, next) => {
  const k = req.ip + req.baseUrl + req.path, now = Date.now();
  const a = (hits.get(k) || []).filter(t => now - t < ms);
  if (a.length >= max) return res.status(429).json({ message: 'Too many attempts. Try again in a few minutes.' });
  a.push(now); hits.set(k, a); next();
};
module.exports = { h, protect, allow, limit };
