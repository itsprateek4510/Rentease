const router = require('express').Router();
const bcrypt = require('bcryptjs'), jwt = require('jsonwebtoken');
const { User, Otp, Order } = require('../models');
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
  u.otpHash = sha(otp + u.email); u.otpExpires = Date.now() + 10 * 60e3; u.otpAttempts = 0; u.otpSentAt = new Date(); await u.save();
  await sendMail(u.email, 'Your RentEase verification code', `Your RentEase code is ${otp}. It expires in 10 minutes. If you didn't request it, ignore this email.`);
  return process.env.NODE_ENV !== 'production' ? otp : undefined; // shown on screen in dev only
}
const sign = u => jwt.sign({ id: u._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
const normPhone = p => String(p || '').replace(/\D/g, '').slice(-10);
const out = u => ({ _id: u._id, name: u.name, email: u.email, role: u.role, city: u.city, phone: u.phone, credits: u.credits || 0, referralCode: u.referralCode,
  wishlist: (u.wishlist || []).map(String), addresses: u.addresses || [], kyc: u.kyc || { status: 'none' } });

router.post('/register', win, h(async (req, res) => {
  const { name, email, password, phone, city, role } = req.body;
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ message: 'Name, email and a password of 6+ characters are required' });
  if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ message: 'Email already registered' });
  const u = await User.create({ name, email, phone: normPhone(phone) || undefined, city, password: await bcrypt.hash(password, 10),
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
  res.json({ token: sign(u), user: out(u) });
}));
router.get('/me', protect, (req, res) => res.json(out(req.user)));

router.put('/profile', protect, h(async (req, res) => {
  const { name, phone, city, email } = req.body;
  if (name !== undefined && !name.trim()) return res.status(400).json({ message: 'Name cannot be empty' });
  if (email && email.toLowerCase() !== req.user.email) {
    if (await User.findOne({ email: email.toLowerCase() })) return res.status(400).json({ message: 'That email is already in use' });
    req.user.email = email.toLowerCase();
  }
  if (name) req.user.name = name;
  if (city !== undefined) req.user.city = city;
  if (phone !== undefined) req.user.phone = normPhone(phone) || undefined;
  await req.user.save(); res.json(out(req.user));
}));
router.put('/change-password', protect, win, h(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const u = await User.findById(req.user._id);
  if (!(await bcrypt.compare(currentPassword || '', u.password))) return res.status(400).json({ message: 'Current password is wrong' });
  if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: 'New password needs 6+ characters' });
  u.password = await bcrypt.hash(newPassword, 10); u.passwordChangedAt = new Date(); await u.save(); // signs out other sessions
  res.json({ token: sign(u), user: out(u) });
}));
router.post('/forgot-password', limit(5, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  let link;
  if (u) {
    const raw = crypto.randomBytes(32).toString('hex');
    u.resetToken = sha(raw); u.resetExpires = Date.now() + 60 * 60e3; await u.save();
    link = `${process.env.CLIENT_URL || 'http://localhost:5173'}/reset/${raw}`;
    await sendMail(u.email, 'Reset your RentEase password', `Reset your password (link valid for 1 hour): ${link}`);
  }
  res.json({ message: 'If that email is registered, a reset link has been sent.', ...(process.env.NODE_ENV !== 'production' && link ? { devLink: link } : {}) });
}));
router.post('/reset-password/:token', limit(10, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ resetToken: sha(req.params.token), resetExpires: { $gt: Date.now() } });
  if (!u) return res.status(400).json({ message: 'This reset link is invalid or has expired' });
  if (!req.body.password || req.body.password.length < 6) return res.status(400).json({ message: 'Password needs 6+ characters' });
  u.password = await bcrypt.hash(req.body.password, 10); u.resetToken = u.resetExpires = undefined; u.passwordChangedAt = new Date(); await u.save();
  res.json({ message: 'Password updated. You can log in now.' });
}));

// Email OTP: verifies sign-ups and also works as a passwordless login
router.post('/send-otp', limit(5, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  const devOtp = u && u.active ? await issueOtp(u) : undefined;
  res.json({ message: 'If that email is registered, a code has been sent.', ...(devOtp ? { devOtp } : {}) });
}));
router.post('/verify-otp', limit(10, 15 * 60e3), h(async (req, res) => {
  const u = await User.findOne({ email: (req.body.email || '').toLowerCase() });
  const bad = () => res.status(400).json({ message: 'That code is wrong or has expired' });
  if (!u || !u.active || !u.otpHash || u.otpExpires < Date.now() || u.otpAttempts >= 5) return bad();
  if (sha(String(req.body.otp || '').trim() + u.email) !== u.otpHash) { u.otpAttempts += 1; await u.save(); return bad(); }
  u.verified = true; u.otpHash = u.otpExpires = undefined; u.otpAttempts = 0; await u.save();
  res.json({ token: sign(u), user: out(u) });
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
  if (sha(String(req.body.otp || '').trim() + phone) !== o.hash) { o.attempts += 1; await o.save(); return bad(); }
  await o.deleteOne();
  let u = await User.findOne({ phone }), isNew = false;
  if (!u) { u = await User.create({ name: 'New user', phone, role: 'user' }); isNew = true; }
  if (!u.active) return res.status(403).json({ message: 'Account is deactivated' });
  res.json({ token: sign(u), user: out(u), isNew });
}));

// ---- Refer & earn: both people get Rs 200 rent credit (usable at checkout)
router.post('/referral', protect, h(async (req, res) => {
  const code = String(req.body.code || '').trim().toUpperCase(), me = await User.findById(req.user._id);
  if (me.referredBy) return res.status(400).json({ message: 'A referral code was already applied' });
  if (await Order.exists({ user: me._id })) return res.status(400).json({ message: 'Referral codes work only before your first order' });
  const ref = await User.findOne({ referralCode: code });
  if (!ref || String(ref._id) === String(me._id)) return res.status(400).json({ message: 'That referral code is not valid' });
  me.referredBy = ref._id; me.credits = (me.credits || 0) + 200; await me.save();
  await User.updateOne({ _id: ref._id }, { $inc: { credits: 200 } });
  res.json({ credits: me.credits });
}));
module.exports = router;
