const { Coupon } = require('../models');
const bad = m => Object.assign(new Error(m), { status: 400 });
// Returns { code, discount, description } or throws. Discount applies to the first month's rent.
exports.checkCoupon = async (code, subtotal) => {
  const c = await Coupon.findOne({ code: String(code || '').trim().toUpperCase(), active: true });
  if (!c) throw bad('Invalid coupon code');
  if (c.expiresAt && c.expiresAt < new Date()) throw bad('This coupon has expired');
  if (subtotal < c.minOrder) throw bad(`Add rentals worth ₹${c.minOrder}/month to use ${c.code}`);
  let d = c.type === 'percent' ? subtotal * c.value / 100 : c.value;
  if (c.maxDiscount) d = Math.min(d, c.maxDiscount);
  return { code: c.code, discount: Math.round(Math.min(d, subtotal)), description: c.description };
};
