const mongoose = require('mongoose');
const { Schema, model } = mongoose, Id = Schema.Types.ObjectId;

const User = model('User', new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, sparse: true, lowercase: true }, // phone-only accounts have no email
  password: String, // phone-only accounts have no password
  role: { type: String, enum: ['user', 'vendor', 'admin'], default: 'user' },
  phone: String, city: String, active: { type: Boolean, default: true },
  resetToken: String, resetExpires: Date, passwordChangedAt: Date,
  verified: { type: Boolean, default: true }, // new sign-ups are created unverified
  otpHash: String, otpExpires: Date, otpAttempts: { type: Number, default: 0 }, otpSentAt: Date,
  credits: { type: Number, default: 0 }, referredBy: { type: Id, ref: 'User' },
  referralCode: { type: String, unique: true, sparse: true, default: () => 'RE' + require('crypto').randomBytes(3).toString('hex').toUpperCase() },
  wishlist: [{ type: Id, ref: 'Product' }],
  addresses: [{ label: String, line: String, city: String, pincode: String }],
  kyc: { status: { type: String, enum: ['none', 'pending', 'verified', 'rejected'], default: 'none' }, docType: String, docNumber: String, submittedAt: Date, note: String }
}, { timestamps: true }));

const Product = model('Product', new Schema({
  sku: { type: String, index: true }, // same across cities for the same catalog item
  name: { type: String, required: true },
  category: { type: String, enum: ['furniture', 'appliance', 'babykids', 'electronics', 'fitness', 'others'], required: true },
  type: String, description: String, image: String, brand: String, capacity: String, badge: String,
  monthlyRent: { type: Number, required: true }, // 3-month price
  securityDeposit: { type: Number, default: 0 },
  tenureOptions: { type: [Number], default: [3, 6, 9, 12] },
  stock: { type: Number, default: 1 }, available: { type: Number, default: 1 },
  city: String, vendor: { type: Id, ref: 'User' },
  ratingAvg: { type: Number, default: 0 }, ratingCount: { type: Number, default: 0 }
}, { timestamps: true }));

const Order = model('Order', new Schema({
  user: { type: Id, ref: 'User', required: true },
  items: [{ product: { type: Id, ref: 'Product' }, sku: String, name: String, vendor: { type: Id, ref: 'User' },
            qty: Number, monthlyRent: Number, deposit: Number, tenure: Number, bundle: String }],
  address: String, city: String, pincode: String, deliveryDate: Date, pickupDate: Date, endDate: Date,
  totalMonthly: Number, totalDeposit: Number, discount: { type: Number, default: 0 }, couponCode: String, creditsUsed: { type: Number, default: 0 }, payable: Number,
  damageCharge: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'upi' }, paymentStatus: { type: String, enum: ['paid', 'pending', 'refunded'], default: 'paid' },
  paidMonths: { type: Number, default: 0 },
  status: { type: String, default: 'placed', enum: ['placed', 'scheduled', 'active', 'return_requested', 'returned', 'damaged', 'cancelled'] }
}, { timestamps: true }));

const Payment = model('Payment', new Schema({
  user: { type: Id, ref: 'User' }, order: { type: Id, ref: 'Order' }, amount: Number,
  type: { type: String, enum: ['initial', 'rent', 'damage'], default: 'rent' },
  method: String, status: { type: String, enum: ['paid', 'pending', 'refunded'], default: 'paid' }, txnId: String, paidAt: Date
}, { timestamps: true }));

const Maintenance = model('Maintenance', new Schema({
  user: { type: Id, ref: 'User' }, order: { type: Id, ref: 'Order' }, vendor: { type: Id, ref: 'User' },
  description: String, status: { type: String, enum: ['open', 'in_progress', 'resolved'], default: 'open' }, resolvedAt: Date
}, { timestamps: true }));

const Dispute = model('Dispute', new Schema({
  user: { type: Id, ref: 'User' }, order: { type: Id, ref: 'Order' },
  type: { type: String, enum: ['dispute', 'damage_claim'], default: 'dispute' },
  message: String, status: { type: String, enum: ['open', 'resolved', 'rejected'], default: 'open' }, resolution: String
}, { timestamps: true }));

const Area = model('Area', new Schema({
  name: { type: String, required: true, unique: true, lowercase: true, trim: true }, lat: Number, lng: Number, active: { type: Boolean, default: true }
}));

const Coupon = model('Coupon', new Schema({
  code: { type: String, required: true, unique: true, uppercase: true, trim: true }, description: String,
  type: { type: String, enum: ['percent', 'flat'], default: 'percent' }, value: { type: Number, required: true },
  minOrder: { type: Number, default: 0 }, maxDiscount: Number, active: { type: Boolean, default: true }, expiresAt: Date
}, { timestamps: true }));

const Package = model('Package', new Schema({
  slug: { type: String, unique: true }, kind: { type: String, enum: ['package', 'plan'], default: 'package' }, features: [String], name: String, tagline: String, discountPercent: { type: Number, default: 10 }, skus: [String]
}, { timestamps: true }));

const Review = model('Review', new Schema({
  sku: { type: String, index: true }, user: { type: Id, ref: 'User' }, userName: String, rating: { type: Number, min: 1, max: 5 }, comment: String
}, { timestamps: true }));

const Contact = model('Contact', new Schema({
  name: String, email: String, phone: String, message: String, status: { type: String, enum: ['new', 'done'], default: 'new' }
}, { timestamps: true }));

const Otp = model('Otp', new Schema({ phone: { type: String, index: true }, hash: String, expires: Date, attempts: { type: Number, default: 0 }, sentAt: Date }));
const Store = model('Store', new Schema({ name: String, city: String, address: String, phone: String, hours: String, lat: Number, lng: Number }));
const ServiceRequest = model('ServiceRequest', new Schema({
  type: { type: String, enum: ['relocation', 'business'], required: true }, name: String, phone: String, email: String, city: String,
  details: Schema.Types.Mixed, status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new' }, user: { type: Id, ref: 'User' }
}, { timestamps: true }));

module.exports = { Otp, Store, ServiceRequest, User, Product, Order, Payment, Maintenance, Dispute, Area, Coupon, Package, Review, Contact };
