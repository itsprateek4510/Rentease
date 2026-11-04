const router = require('express').Router();
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { User, Otp, Order, RefreshSession } = require('../models');
const { startSession, clearSessionCookie, hash, lifetime, tokenFor, writeCookie } = require('../utils/session');
const { sendSms } = require('../utils/sms');
const crypto = require('crypto');
const { h, protect, limit } = require('../middleware/auth');
const { sendMail } = require('../utils/mailer');
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const win = limit(10, 15 * 60e3);

// Create a 6-digit code (hashed, 10 min expiry, max 5 tries, 60 s between sends) and email it.
async function issueOtp(u) {
  if (u.otpSentAt && Date.now() - u.otpSentAt < 60e3) throw Object.assign(new Error('Wait a minute before requesting another code'), { status: 429 });
  const otp = String(crypto.randomInt(100000, 1000000));
  const email = u.pendingEmail || u.email;
  u.otpHash = sha(otp + email); u.otpExpires = Date.now() + 10 * 60e3; u.otpAttempts = 0; u.otpSentAt = new Date(); await u.save();
  await sendMail(email, 'Your RentEase verification code', `Your RentEase code is ${otp}. It expires in 10 minutes. If you didn't request it, ignore this email.`);
  return process.env.NODE_ENV !== 'production' ? otp : undefined; // shown on screen in dev only
}
const normPhone = p => { const s = String(p || '').replace(/[\s()+-]/g, ''); return /^91[6-9]\d{9}$/.test(s) ? s.slice(2) : s; };
const out = u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, city: u.city, phone: u.phone, credits: u.credits || 0, referralCode: u.referralCode,
  wishlist: (u.wishlist || []).map(String), addresses: u.addresses || [], kyc: u.kyc || { status: 'none' }, hasPassword: !!u.password });

router.post('/refresh', h(async (req, res) => {
  const raw = req.cookies.refresh;
  if (!raw) return res.status(401).json({ message: 'Please log in' });
  const next = crypto.randomBytes(48).toString('base64url');
  const session = await RefreshSession.findOneAndUpdate({ hash: hash(raw), expiresAt: { $gt: new Date() } }, { hash: hash(next), expiresAt: new Date(Date.now() + lifetime) }, { new: true });
  const u = session && await User.findById(session.user);
  if (!u || !u.active) {
    if (session) await session.deleteOne();
    clearSessionCookie(res); return res.status(401).json({ message: 'Session expired, log in again' });
  }
  writeCookie(res, next); res.json({ token: tokenFor(u, session), user: out(u) });
}));
router.post('/logout', h(async (req, res) => {
  if (req.cookies.refresh) await RefreshSession.deleteOne({ hash: hash(req.cookies.refresh) });
  // The cookie may have rotated in an overlapping refresh request.
  try {
    const access = jwt.verify((req.headers.authorization || '').replace('Bearer ', ''), process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'rentease', audience: 'rentease-client', ignoreExpiration: true });
    if (access.type === 'access') await RefreshSession.deleteOne({ _id: access.sid, user: access.id });
  } catch { /* an absent/invalid access token must not prevent clearing the cookie */ }
  clearSessionCookie(res); res.status(204).end();
}));
router.get('/providers', (req, res) => res.json({ google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI) }));
const google = () => {
  const { OAuth2Client } = require('google-auth-library');
  return new OAuth2Client(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI);
};
const oauthCookie = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/auth/google' });
router.get('/google', h(async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) return res.status(503).json({ message: 'Google sign-in is not configured. Use phone or email login.' });
  const client = google(), state = crypto.randomBytes(32).toString('base64url'), nonce = crypto.randomBytes(32).toString('base64url');
  const { codeVerifier, codeChallenge } = await client.generateCodeVerifierAsync();
  res.cookie('oauth', jwt.sign({ state, nonce, codeVerifier, role: req.query.role === 'vendor' ? 'vendor' : 'user', type: 'oauth' }, process.env.JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256', audience: 'google-login' }), { ...oauthCookie(), maxAge: 10 * 60e3 });
  res.redirect(client.generateAuthUrl({ scope: ['openid', 'email', 'profile'], state, nonce, code_challenge: codeChallenge, code_challenge_method: 'S256', prompt: 'select_account' }));
}));
router.get('/google/callback', h(async (req, res) => {
  const cookie = req.cookies.oauth; res.clearCookie('oauth', oauthCookie());
  let flow;
  try { flow = jwt.verify(cookie || '', process.env.JWT_SECRET, { algorithms: ['HS256'], audience: 'google-login' }); } catch { return res.status(400).json({ message: 'Invalid or expired Google sign-in. Please try again.' }); }
  if (flow.type !== 'oauth' || !req.query.state || flow.state !== req.query.state || typeof req.query.code !== 'string') return res.status(400).json({ message: 'Invalid Google sign-in state or authorization code' });
  try {
    const client = google(), { tokens } = await client.getToken({ code: req.query.code, codeVerifier: flow.codeVerifier });
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID }), profile = ticket.getPayload();
    if (!profile?.sub || !profile.email_verified || profile.nonce !== flow.nonce) return res.status(400).json({ message: 'Google could not verify this account' });
    let u = await User.findOne({ googleId: profile.sub });
    if (!u) {
      // Do not silently link an existing email account, even when Google verified the email.
      if (await User.exists({ email: profile.email.toLowerCase() })) return res.status(409).json({ message: 'This email already has an account. Please use its existing login method.' });
      u = await User.create({ name: profile.name || 'Google user', email: profile.email.toLowerCase(), googleId: profile.sub, verified: true, role: flow.role === 'vendor' ? 'vendor' : 'user' });
    }
    if (!u.active) return res.status(403).json({ message: 'Account is deactivated' });
    await startSession(u, res);
    res.redirect((process.env.CLIENT_URL || 'http://localhost:5175').split(',')[0].trim() + '/auth/callback');
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ message: 'This account already exists. Please sign in again.' });
    res.status(502).json({ message: 'Google sign-in failed. Please try again or use phone/email.' });
  }
}));

router.post('/register', win, h(async (req, res) => {
  const { name, email, password, phone, city, role } = req.body;
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 8)
    return res.status(400).json({ message: 'Name, valid email and a password of 8+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ message: 'Email already registered' });
  const u = await User.create({ name, email, city, password: await bcrypt.hash(password, 10),
    role: role === 'vendor' ? 'vendor' : 'user', verified: false }); // admins are created via seed only
  const devOtp = await issueOtp(u);
  res.status(201).json({ needsVerification: true, email: u.email, devOtp });
}));
router.post('/login', win, h(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  if (!u || !u.password || !(await bcrypt.compare(req.body.password || '', u.password))) return res.status(400).json({ message: 'Wrong email or password' });
  if (!u.active) return res.status(403).json({ message: 'Account is deactivated' });
  if (!u.verified) {
    let devOtp; try { devOtp = await issueOtp(u); } catch { /* a code was sent moments ago */ }
    return res.status(403).json({ message: 'Verify your email to continue', needsVerification: true, email: u.email, devOtp });
  }
  res.json({ token: await startSession(u, res), user: out(u) });
}));
router.get('/me', protect, (req, res) => res.json(out(req.user)));

router.put('/profile', protect, h(async (req, res) => {
  const { name, phone, city, email } = req.body;
  if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
  let devOtp;
  if (phone !== undefined && normPhone(phone) !== (req.user.phone || '')) return res.status(400).json({ message: 'Changing your phone requires OTP verification. Use your verified phone number.' });
  if (email && email.toLowerCase() !== req.user.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ message: 'Enter a valid email' });
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ message: 'That email is already in use' });
    req.user.pendingEmail = email.toLowerCase(); devOtp = await issueOtp(req.user);
  }
  if (name) req.user.name = name;
  if (city !== undefined) req.user.city = city;
  await req.user.save(); res.json({ ...out(req.user), ...(req.user.pendingEmail ? { needsVerification: true, verificationEmail: req.user.pendingEmail, devOtp } : {}) });
}));
router.put('/change-password', protect, win, h(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const u = await User.findById(req.user._id);
  if (!u.password || !(await bcrypt.compare(currentPassword || '', u.password))) return res.status(400).json({ message: 'Current password is wrong or this account uses passwordless login' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password needs 6+ characters' });
  u.password = await bcrypt.hash(newPassword, 10); u.passwordChangedAt = new Date(); await u.save(); // signs out other sessions
  await RefreshSession.deleteMany({ user: u._id });
  res.json({ token: await startSession(u, res), user: out(u) });
}));
router.post('/forgot-password', limit(5, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  let link;
  if (u) {
    const raw = crypto.randomBytes(32).toString('hex');
    u.resetToken = sha(raw); u.resetExpires = Date.now() + 60 * 60e3; await u.save();
    link = `${(process.env.CLIENT_URL || 'http://localhost:5175').split(',')[0].trim()}/reset/${raw}`;
    await sendMail(u.email, 'Reset your RentEase password', `Reset your password (link valid for 1 hour): ${link}`);
  }
  res.json({ message: 'If that email is registered, a reset link has been sent.', ...(process.env.NODE_ENV !== 'production' && link ? { devLink: link } : {}) });
}));
router.post('/reset-password/:token', limit(10, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ resetToken: sha(req.params.token), resetExpires: { $gt: Date.now() } });
  if (!u) return res.status(400).json({ message: 'This reset link is invalid or has expired' });
  if (!req.body.password || req.body.password.length < 6) return res.status(400).json({ message: 'Password needs 6+ characters' });
  u.password = await bcrypt.hash(req.body.password, 10); u.resetToken = u.resetExpires = undefined; u.passwordChangedAt = new Date(); await u.save();
  await RefreshSession.deleteMany({ user: u._id });
  res.json({ message: 'Password updated. You can log in now.' });
}));

// Email OTP: verifies sign-ups and also works as a passwordless login
router.post('/send-otp', limit(5, 15 * 60e3), h(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase();
  const u = await User.findOne({ $or: [{ email }, { pendingEmail: email }] });
  const devOtp = u && u.active ? await issueOtp(u) : undefined;
  res.json({ message: 'If that email is registered, a code has been sent.', ...(devOtp ? { devOtp } : {}) });
}));
router.post('/verify-otp', limit(10, 15 * 60e3), h(async (req, res) => {
  const email = String(req.body.email || '').toLowerCase();
  const u = await User.findOne({ $or: [{ email }, { pendingEmail: email }] });
  const bad = () => res.status(400).json({ message: 'That code is wrong or has expired' });
  if (!u || (u.pendingEmail || u.email) !== email || !u.active || !u.otpHash || u.otpExpires < Date.now() || u.otpAttempts >= 5) return bad();
  if (sha(String(req.body.otp || '').trim() + email) !== u.otpHash) { await User.updateOne({ _id: u._id }, { $inc: { otpAttempts: 1 } }); return bad(); }
  const consumed = await User.updateOne({ _id: u._id, otpHash: u.otpHash, otpAttempts: { $lt: 5 }, otpExpires: { $gt: new Date() } }, { $unset: { otpHash: 1, otpExpires: 1 } });
  if (!consumed.modifiedCount) return bad();
  if (u.pendingEmail) { u.email = u.pendingEmail; u.pendingEmail = undefined; }
  u.verified = true; u.otpHash = u.otpExpires = undefined; u.otpAttempts = 0; await u.save();
  res.json({ token: await startSession(u, res), user: out(u) });
}));

// ---- Phone OTP login / sign-up (the main way customers log in)
router.post('/phone/send', limit(8, 15 * 60e3), h(async (req, res) => {
  const phone = normPhone(req.body.phone);
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ message: 'Enter a valid 10-digit mobile number' });
  if (!req.body.consent) return res.status(400).json({ message: 'Please accept the terms to continue' });
  let o = await Otp.findOne({ phone });
  if (o?.sentAt && Date.now() - o.sentAt < 30e3) return res.status(429).json({ message: 'Please wait 30 seconds before asking for another code' });
  const otp = String(crypto.randomInt(100000, 1000000));
  o = o || new Otp({ phone }); Object.assign(o, { hash: sha(otp + phone), expires: Date.now() + 10 * 60e3, attempts: 0, sentAt: new Date() }); await o.save();
  await sendSms(phone, `${otp} is your RentEase verification code. It is valid for 10 minutes.`);
  res.json({ message: 'Code sent', ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}) });
}));
router.post('/phone/verify', limit(12, 15 * 60e3), h(async (req, res) => {
  const phone = normPhone(req.body.phone), o = await Otp.findOne({ phone });
  const bad = () => res.status(400).json({ message: 'That code is wrong or has expired' });
  if (!o || o.expires < Date.now() || o.attempts >= 5) return bad();
  if (sha(String(req.body.otp || '').trim() + phone) !== o.hash) { await Otp.updateOne({ _id: o._id }, { $inc: { attempts: 1 } }); return bad(); }
  if (!await Otp.findOneAndDelete({ _id: o._id, hash: o.hash, attempts: { $lt: 5 }, expires: { $gt: new Date() } })) return bad();
  let u = await User.findOne({ phone }), isNew = false;
  if (!u) { u = await User.create({ name: 'New user', phone, role: 'user' }); isNew = true; }
  if (!u.active) return res.status(403).json({ message: 'Account is deactivated' });
  res.json({ token: await startSession(u, res), user: out(u), isNew });
}));

// ---- Refer & earn: both people get Rs 200 rent credit (usable at checkout)
router.post('/referral', protect, h(async (req, res) => {
  const result = await require('mongoose').connection.transaction(async session => {
  const code = String(req.body.code || '').trim().toUpperCase(), me = await User.findById(req.user._id).session(session);
  if (me.referredBy) throw Object.assign(new Error('A referral code was already applied'), { status: 400 });
  if (await Order.exists({ user: me._id }).session(session)) throw Object.assign(new Error('Referral codes work only before your first order'), { status: 400 });
  const ref = await User.findOne({ referralCode: code }).session(session);
  if (!ref || !ref.active || String(ref._id) === String(me._id)) throw Object.assign(new Error('That referral code is not valid'), { status: 400 });
  const updated = await User.findOneAndUpdate({ _id: me._id, referredBy: null }, { $set: { referredBy: ref._id }, $inc: { credits: 200 } }, { new: true, session });
  if (!updated) throw Object.assign(new Error('A referral code was already applied'), { status: 400 });
  await User.updateOne({ _id: ref._id }, { $inc: { credits: 200 } }, { session });
  return { credits: updated.credits };
  });
  res.json(result);
}));
module.exports = router;
