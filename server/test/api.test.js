const { test, before, after, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
process.env.CLIENT_URL = 'http://localhost:5174';
process.env.NODE_ENV = 'test';
const app = require('../app');
const { User, Product, RefreshSession, Order } = require('../models');
let mongo, customer, vendor;
before(async () => { mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); await mongoose.connect(mongo.getUri()); await Promise.all(Object.values(mongoose.models).map(m => m.init())); });
after(async () => { await mongoose.disconnect(); if (mongo) await mongo.stop(); });
afterEach(() => mock.restoreAll());
beforeEach(async () => {
  require('../middleware/auth').clearLimits();
  await Promise.all(Object.values(mongoose.models).map(m => m.deleteMany({})));
  customer = await User.create({ name: 'Customer', email: 'customer@example.com', password: await bcrypt.hash('password123', 4) });
  vendor = await User.create({ name: 'Lender', email: 'lender@example.com', role: 'vendor', password: await bcrypt.hash('password123', 4) });
});
async function login(email = customer.email) { return request(app).post('/api/auth/login').send({ email, password: 'password123' }).expect(200); }
function cookie(r) { return r.headers['set-cookie'].find(c => c.startsWith('refresh=')).split(';')[0]; }
async function product(coverage = { mode: 'nationwide' }) { return Product.create({ name: 'Chair', category: 'furniture', monthlyRent: 100, stock: 2, available: 2, city: 'Delhi', vendor: vendor._id, coverage }); }

test('login issues a short JWT and HttpOnly cookie; refresh rotates; logout revokes access', async () => {
  const r = await login(), jwt = require('jsonwebtoken').decode(r.body.token);
  assert.ok(jwt.exp - jwt.iat <= 900);
  assert.match(r.headers['set-cookie'].join(';'), /HttpOnly/);
  await request(app).get('/api/auth/me').auth(r.body.token, { type: 'bearer' }).expect(200);
  const renewed = await request(app).post('/api/auth/refresh').set('Cookie', cookie(r)).expect(200);
  assert.notEqual(cookie(r), cookie(renewed));
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(r)).expect(401);
  await request(app).post('/api/auth/logout').set('Cookie', cookie(renewed)).expect(204);
  await request(app).get('/api/auth/me').auth(renewed.body.token, { type: 'bearer' }).expect(401);
  assert.equal(await RefreshSession.countDocuments(), 0);
});
test('cross-site refresh and disabled users are rejected', async () => {
  const r = await login();
  await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.example').set('Cookie', cookie(r)).expect(403);
  await User.updateOne({ _id: customer._id }, { active: false });
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(r)).expect(401);
});
test('Google OAuth is unavailable without credentials and invalid state cannot log in', async () => {
  await request(app).get('/api/auth/google').expect(503);
  await request(app).get('/api/auth/google/callback?code=fake&state=fake').expect(400);
});
test('profile cannot hijack another phone number and email changes require verification', async () => {
  const r = await login();
  await request(app).put('/api/auth/profile').auth(r.body.token, { type: 'bearer' }).send({ phone: '9876543210' }).expect(400);
  const changed = await request(app).put('/api/auth/profile').auth(r.body.token, { type: 'bearer' }).send({ email: 'new@example.com' }).expect(200);
  assert.equal(changed.body.email, customer.email);
  assert.equal(changed.body.needsVerification, true);
});
test('catalog includes nationwide listings and excludes lender-restricted listings', async () => {
  await product(); await product({ mode: 'city' });
  const r = await request(app).get('/api/products?city=Kochi&state=Kerala').expect(200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].coverage.mode, 'nationwide');
});
test('product writes reject invalid stock and cannot override server-owned fields', async () => {
  const r = await login(vendor.email);
  await request(app).post('/api/products').auth(r.body.token, { type: 'bearer' }).send({ name: 'Bad', category: 'furniture', monthlyRent: -1, stock: -1, city: 'Delhi' }).expect(400);
  const p = await request(app).post('/api/products').auth(r.body.token, { type: 'bearer' }).send({ name: 'Chair', category: 'furniture', monthlyRent: 100, stock: 2, city: 'Delhi', vendor: customer._id, ratingAvg: 5, available: 999 }).expect(201);
  assert.equal(p.body.vendor, String(vendor._id)); assert.equal(p.body.available, 2); assert.equal(p.body.ratingAvg, 0);
});
test('checkout rejects invalid quantities, dates and unverified delivery locations without reserving stock', async () => {
  const r = await login(), p = await product();
  const body = { items: [{ product: p._id, qty: 0.5, tenure: 3 }], address: 'Home', city: 'Kochi', pincode: '682001', deliveryDate: '2099-01-01' };
  await request(app).post('/api/orders').auth(r.body.token, { type: 'bearer' }).send(body).expect(400);
  body.items[0].qty = 1; body.deliveryDate = 'not-a-date';
  await request(app).post('/api/orders').auth(r.body.token, { type: 'bearer' }).send(body).expect(400);
  assert.equal((await Product.findById(p._id)).available, 2); assert.equal(await Order.countDocuments(), 0);
});

test('Google authorization-code flow checks state, PKCE and nonce and returns no token in the URL', async () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'; process.env.GOOGLE_REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';
  try {
    const { OAuth2Client } = require('google-auth-library');
    const start = await request(app).get('/api/auth/google').expect(302), redirect = new URL(start.headers.location);
    assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
    const state = redirect.searchParams.get('state'), nonce = redirect.searchParams.get('nonce');
    mock.method(OAuth2Client.prototype, 'getToken', async options => { assert.ok(options.codeVerifier); return { tokens: { id_token: 'google-token' } }; });
    mock.method(OAuth2Client.prototype, 'verifyIdToken', async options => { assert.equal(options.audience, 'test-client'); return { getPayload: () => ({ sub: 'google-123', email: 'google@example.com', email_verified: true, name: 'Google user', nonce }) }; });
    const done = await request(app).get('/api/auth/google/callback').query({ code: 'code', state }).set('Cookie', start.headers['set-cookie'][0].split(';')[0]).expect(302);
    assert.equal(done.headers.location, 'http://localhost:5174/auth/callback');
    assert.ok(cookie(done)); assert.equal((await User.findOne({ googleId: 'google-123' })).role, 'user');
  } finally { delete process.env.GOOGLE_CLIENT_ID; delete process.env.GOOGLE_CLIENT_SECRET; delete process.env.GOOGLE_REDIRECT_URI; }
});
test('checkout verifies PIN server-side, enforces lender coverage and commits or rolls back inventory', async () => {
  mock.method(require('../utils/location'), 'postalLocation', async pin => ({ pincode: pin, country: 'IN', city: 'kochi', state: 'Kerala' }));
  const r = await login(), p = await product();
  const body = { items: [{ product: String(p._id), qty: 1, tenure: 3 }], address: 'Home', city: 'Spoofed client city', pincode: '682001', deliveryDate: '2099-01-01' };
  const placed = await request(app).post('/api/orders').auth(r.body.token, { type: 'bearer' }).send(body).expect(201);
  assert.equal(placed.body.city, 'kochi'); assert.equal((await Product.findById(p._id)).available, 1);
  const local = await product({ mode: 'city' }); body.items.push({ product: String(local._id), qty: 1, tenure: 3 });
  await request(app).post('/api/orders').auth(r.body.token, { type: 'bearer' }).send(body).expect(400);
  assert.equal((await Product.findById(p._id)).available, 1);
  const results = await Promise.all([1, 2].map(() => request(app).put('/api/orders/' + placed.body._id + '/cancel').auth(r.body.token, { type: 'bearer' })));
  assert.deepEqual(results.map(x => x.status).sort(), [200, 400]);
  assert.equal((await Product.findById(p._id)).available, 2);
});
test('invalid object IDs return 400 and unauthenticated writes return 401', async () => {
  await request(app).get('/api/products/not-an-id').expect(400);
  await request(app).post('/api/products').send({}).expect(401);
});
test('changing password invalidates other access tokens and refresh sessions', async () => {
  const a = await login(), b = await login();
  const changed = await request(app).put('/api/auth/change-password').auth(a.body.token, { type: 'bearer' }).send({ currentPassword: 'password123', newPassword: 'new-password123' }).expect(200);
  await request(app).get('/api/auth/me').auth(b.body.token, { type: 'bearer' }).expect(401);
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(b)).expect(401);
  await request(app).get('/api/auth/me').auth(changed.body.token, { type: 'bearer' }).expect(200);
});
test('an unverified phone on email registration never becomes a login identity', async () => {
  await request(app).post('/api/auth/register').send({ name: 'Another customer', email: 'other@example.com', password: 'password123', phone: '9876543210' }).expect(201);
  assert.equal((await User.findOne({ email: 'other@example.com' })).phone, undefined);
});
test('logout revokes a rotated session even when the browser sent its previous cookie', async () => {
  const a = await login();
  const b = await request(app).post('/api/auth/refresh').set('Cookie', cookie(a)).expect(200);
  await request(app).post('/api/auth/logout').auth(a.body.token, { type: 'bearer' }).set('Cookie', cookie(a)).expect(204);
  await request(app).post('/api/auth/refresh').set('Cookie', cookie(b)).expect(401);
});
test('retrying the same checkout key returns the original order without reserving more stock', async () => {
  mock.method(require('../utils/location'), 'postalLocation', async pin => ({ pincode: pin, country: 'IN', city: 'kochi', state: 'Kerala' }));
  const r = await login(), p = await product();
  const body = { items: [{ product: String(p._id), qty: 1, tenure: 3 }], address: 'Home', city: 'Kochi', pincode: '682001', deliveryDate: '2099-01-01' };
  const send = data => request(app).post('/api/orders').set('Idempotency-Key', 'checkout-test-123').auth(r.body.token, { type: 'bearer' }).send(data);
  const a = await send(body).expect(201), b = await send(body).expect(200);
  assert.equal(a.body._id, b.body._id); assert.equal((await Product.findById(p._id)).available, 1);
  await send({ ...body, address: 'Different address' }).expect(409);
});
test('concurrent referral requests award credits only once', async () => {
  const ref = await User.create({ name: 'Referrer', email: 'ref@example.com', referralCode: 'REF123' }), r = await login();
  const results = await Promise.all([1, 2].map(() => request(app).post('/api/auth/referral').auth(r.body.token, { type: 'bearer' }).send({ code: ref.referralCode })));
  assert.deepEqual(results.map(x => x.status).sort(), [200, 400]);
  assert.equal((await User.findById(customer._id)).credits, 200); assert.equal((await User.findById(ref._id)).credits, 200);
});
test('production cannot mark a fake online payment as paid', async () => {
  const r = await login(), p = await product();
  process.env.NODE_ENV = 'production';
  try {
    await request(app).post('/api/orders').auth(r.body.token, { type: 'bearer' }).send({ items: [{ product: String(p._id), qty: 1, tenure: 3 }], address: 'Home', city: 'Kochi', pincode: '682001', deliveryDate: '2099-01-01', paymentMethod: 'upi' }).expect(503);
    assert.equal((await Product.findById(p._id)).available, 2);
  } finally { process.env.NODE_ENV = 'test'; }
});
