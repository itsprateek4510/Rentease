const jwt = require('jsonwebtoken');
const { User, RefreshSession } = require('../models');
const h = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const protect = h(async (req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ message: 'Please log in' });
  try {
    const { id, sid, type, iat } = jwt.verify(t, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'rentease', audience: 'rentease-client' });
    if (type !== 'access' || !sid || !await RefreshSession.exists({ _id: sid, user: id, expiresAt: { $gt: new Date() } })) return res.status(401).json({ message: 'Session expired, log in again' });
    const u = await User.findById(id);
    if (!u || !u.active) return res.status(401).json({ message: 'Account unavailable' });
    if (u.passwordChangedAt && iat < Math.floor(u.passwordChangedAt.getTime() / 1000)) return res.status(401).json({ message: 'Password changed, log in again' });
    req.user = u; req.sessionId = sid; next();
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
const cleanup = setInterval(() => { const now = Date.now(); for (const [key, values] of hits) if (!values.some(t => now - t < 15 * 60e3)) hits.delete(key); }, 15 * 60e3);
cleanup.unref();
module.exports = { h, protect, allow, limit, clearLimits: () => hits.clear() };
