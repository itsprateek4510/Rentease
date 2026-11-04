const crypto = require('crypto'), jwt = require('jsonwebtoken');
const { RefreshSession } = require('../models');
const hash = raw => crypto.createHash('sha256').update(raw).digest('hex');
const lifetime = 30 * 864e5;
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth' });
const tokenFor = (u, session) => jwt.sign({ id: String(u._id), sid: String(session._id), type: 'access' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m', issuer: 'rentease', audience: 'rentease-client' });
function writeCookie(res, raw) { res.cookie('refresh', raw, { ...cookieOptions(), maxAge: lifetime }); }
async function startSession(u, res) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const session = await RefreshSession.create({ user: u._id, hash: hash(raw), expiresAt: new Date(Date.now() + lifetime) });
  writeCookie(res, raw);
  return tokenFor(u, session);
}
const clearSessionCookie = res => res.clearCookie('refresh', cookieOptions());
module.exports = { hash, lifetime, tokenFor, writeCookie, startSession, clearSessionCookie };
