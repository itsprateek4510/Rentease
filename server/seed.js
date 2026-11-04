require('dotenv').config();
const mongoose = require('mongoose'), bcrypt = require('bcryptjs');
const M = require('./models');
const { User, Product, Area, Order, Maintenance, Dispute, Payment, Coupon, Package, Review, Contact, Store, ServiceRequest } = M;
const { rentFor } = require('./utils/pricing');

// Real product photos stored in client/public/products (one per catalog item).
// Regenerate with `node scripts/fetchProductImages.js` from the server folder.
const IMAGES = require('./productImages.json');
const photo = name => IMAGES[name] || '';
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const capOf = n => { const m = n.match(/(\d+(?:\.\d+)?)\s?(Ton|L|kg|")/i); if (!m) return ''; const u = m[2] === '"' ? 'inch' : m[2].toLowerCase() === 'l' ? 'L' : m[2]; return `${m[1]} ${u}`; };

// [name, type, 3-month rent, deposit, brand]
const G = (cat, rows) => rows.map(r => [r[0], cat, r[1], r[2], r[3], r[4] || '']);
const T = [
  ...G('furniture', [['Single Bed with Storage', 'bed', 599, 1200], ['Queen Bed with Storage', 'bed', 999, 2000], ['King Bed with Storage', 'bed', 1299, 2600],
    ['Single Orthopaedic Mattress', 'mattress', 299, 600], ['Queen Orthopaedic Mattress', 'mattress', 399, 800], ['King Memory Foam Mattress', 'mattress', 599, 1200],
    ['2-Seater Fabric Sofa', 'sofa', 599, 1200], ['3-Seater Fabric Sofa', 'sofa', 799, 1600], ['L-Shape Sofa', 'sofa', 1199, 2400],
    ['Ergonomic Office Chair', 'chair', 399, 800], ['Recliner Chair', 'chair', 899, 1800], ['Bar Stool', 'chair', 199, 400], ['Gaming Chair', 'chair', 599, 1200],
    ['2-Door Wardrobe', 'wardrobe', 599, 1200], ['3-Door Wardrobe', 'wardrobe', 799, 1600], ['Shoe Rack Organizer', 'wardrobe', 199, 400],
    ['Study Table', 'study table', 349, 700], ['Computer Desk with Drawers', 'study table', 449, 900], ['Foldable Laptop Table', 'study table', 199, 400],
    ['Coffee Table', 'center table', 299, 600], ['Glass Center Table', 'center table', 349, 700],
    ['4-Seater Dining Table Set', 'dining table', 899, 1800], ['6-Seater Dining Table Set', 'dining table', 1299, 2600],
    ['Bedside Table', 'bedside table', 149, 300], ['Bedside Table with Drawer', 'bedside table', 199, 400], ['4-Drawer Chest', 'drawers', 399, 800], ['5-Drawer Chest', 'drawers', 499, 1000],
    ['5-Tier Bookshelf', 'shelf', 299, 600], ['TV Unit', 'shelf', 349, 700]]),
  ...G('appliance', [['Double Door Refrigerator 260L', 'fridge', 899, 2000, 'Samsung'], ['Single Door Refrigerator 190L', 'fridge', 599, 1500, 'Whirlpool'], ['Mini Fridge 90L', 'fridge', 399, 1000, 'Haier'], ['Double Door Refrigerator 350L', 'fridge', 1199, 2800, 'LG'],
    ['Front Load Washing Machine 7kg', 'washing machine', 1099, 2500, 'IFB'], ['Top Load Washing Machine 6.5kg', 'washing machine', 799, 1800, 'LG'], ['Semi-Automatic Washing Machine 7kg', 'washing machine', 499, 1200, 'Samsung'], ['Front Load Washing Machine 8kg', 'washing machine', 1399, 3000, 'Bosch'],
    ['RO Water Purifier', 'purifier', 449, 1000, 'Aquaguard'], ['RO+UV Water Purifier 8L', 'purifier', 549, 1200, 'Kent'], ['Air Purifier for Small Rooms', 'air purifier', 499, 1200, 'Philips'], ['Air Purifier for Large Rooms', 'air purifier', 799, 1800, 'Honeywell'],
    ['1 Ton 3 Star Inverter Split AC', 'ac', 1499, 3500, 'Voltas'], ['1.5 Ton 3 Star Inverter Split AC', 'ac', 1799, 4000, 'LG'], ['2 Ton 3 Star Inverter Split AC', 'ac', 2399, 5000, 'Daikin'], ['1 Ton Window AC', 'ac', 1099, 2800, 'Hitachi'],
    ['32" LED TV', 'tv', 599, 1400, 'Xiaomi'], ['43" Smart LED TV', 'tv', 999, 2200, 'Samsung'], ['55" 4K Smart TV', 'tv', 1599, 3500, 'Sony'], ['65" 4K Smart TV', 'tv', 2299, 5000, 'LG'],
    ['Microwave Oven 20L', 'microwave', 399, 900, 'Samsung'], ['Convection Microwave 25L', 'microwave', 599, 1400, 'IFB'], ['Induction Cooktop', 'cooktop', 249, 600, 'Prestige'],
    ['Air Cooler 50L', 'cooler', 349, 800, 'Symphony'], ['Air Cooler 75L', 'cooler', 449, 1000, 'Crompton'], ['12 Place Dishwasher', 'dishwasher', 1499, 3500, 'Bosch'],
    ['Robot Vacuum Cleaner', 'vacuum', 599, 1500, 'Xiaomi'], ['Handheld Vacuum Cleaner', 'vacuum', 299, 700, 'Philips'], ['Air Fryer 4L', 'kitchen', 299, 700, 'Philips'], ['Mixer Grinder', 'kitchen', 249, 600, 'Bajaj'], ['Geyser 15L', 'geyser', 349, 800, 'Bajaj']]),
  ...G('babykids', [['Baby Crib with Mattress', 'crib', 499, 1200], ['Baby Stroller', 'stroller', 399, 1000], ['Baby High Chair', 'highchair', 249, 600], ['Kids Study Table & Chair', 'kids', 349, 800], ['Kids Bed', 'kids', 499, 1000]]),
  ...G('electronics', [['Laptop Core i5 8GB', 'laptop', 1299, 3000, 'HP'], ['Gaming Laptop RTX', 'laptop', 2499, 6000, 'ASUS'], ['MacBook Air M2', 'laptop', 1999, 5000, 'Apple'], ['Tablet 10-inch', 'tablet', 599, 1500, 'Samsung'],
    ['Smartphone 5G', 'phone', 799, 2000, 'Xiaomi'], ['Soundbar 2.1', 'speaker', 449, 1000, 'boAt'], ['24" Full HD Monitor', 'monitor', 499, 1200, 'Dell']]),
  ...G('fitness', [['Motorised Treadmill', 'treadmill', 1499, 3500], ['Exercise Bike', 'bike', 999, 2500], ['Cross Trainer', 'trainer', 1299, 3000], ['Dumbbell Set 20kg', 'dumbbell', 299, 700], ['Home Multi-Gym', 'gym', 1999, 5000], ['Massage Chair', 'massage', 2499, 6000]]),
  ...G('others', [['Inverter with Battery', 'inverter', 899, 2500, 'Luminous'], ['Gaming Console', 'console', 1999, 5000, 'Sony'], ['DSLR Camera', 'camera', 1499, 4000, 'Canon']])
];
const badgeOf = i => (i % 7 === 0 ? 'Best Seller' : i % 5 === 1 ? 'Popular' : i % 9 === 4 ? 'Price Drop' : i % 11 === 6 ? 'New' : '');

const C = [['Delhi', 28.61, 77.21], ['Noida', 28.54, 77.39], ['Gurugram', 28.46, 77.03], ['Mumbai', 19.08, 72.88], ['Pune', 18.52, 73.86],
  ['Bengaluru', 12.97, 77.59], ['Hyderabad', 17.39, 78.49], ['Chennai', 13.08, 80.27], ['Lucknow', 26.85, 80.95], ['Aligarh', 27.88, 78.08]];
const AREAS = { Delhi: ['Connaught Place', 'Saket'], Noida: ['Sector 18', 'Sector 62'], Gurugram: ['Cyber Hub', 'Sohna Road'], Mumbai: ['Andheri West', 'Powai'], Pune: ['Koregaon Park', 'Hinjewadi'],
  Bengaluru: ['Indiranagar', 'Koramangala'], Hyderabad: ['Madhapur', 'Banjara Hills'], Chennai: ['T. Nagar', 'OMR'], Lucknow: ['Hazratganj', 'Gomti Nagar'], Aligarh: ['Civil Lines', 'Marris Road'] };
const mult = { Mumbai: 1.15, Bengaluru: 1.1, Gurugram: 1.1, Pune: 1.05 };
const day = 864e5, ago = d => new Date(Date.now() - d * day), addM = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const FEAT = ['Free item swap every 3 months', 'Free relocation within the city', 'Free maintenance and replacement', 'No lock-in after 6 months'];
// [slug, kind, name, tagline, discount %, item names]
const PK = [
  ['student-starter', 'package', 'Student Starter Pack', 'Everything for a hostel or PG room', 10, ['Single Bed with Storage', 'Single Orthopaedic Mattress', 'Study Table', 'Ergonomic Office Chair', 'Mini Fridge 90L']],
  ['bachelor-pad', 'package', 'Bachelor Pad Pack', 'Move in and live comfortably', 12, ['Queen Bed with Storage', 'Queen Orthopaedic Mattress', '2-Seater Fabric Sofa', 'Single Door Refrigerator 190L', 'Semi-Automatic Washing Machine 7kg', '32" LED TV']],
  ['work-from-home', 'package', 'Work From Home Pack', 'A complete home office setup', 10, ['Computer Desk with Drawers', 'Ergonomic Office Chair', 'Laptop Core i5 8GB', '24" Full HD Monitor', '5-Tier Bookshelf']],
  ['home-gym', 'package', 'Home Fitness Pack', 'Cardio and strength at home', 8, ['Motorised Treadmill', 'Exercise Bike', 'Dumbbell Set 20kg']],
  ['summer-cool', 'package', 'Summer Cool Pack', 'Beat the heat and drink clean water', 10, ['1.5 Ton 3 Star Inverter Split AC', 'Air Cooler 50L', 'RO Water Purifier']],
  ['baby-care', 'package', 'New Baby Pack', 'Safe, comfy essentials for your little one', 8, ['Baby Crib with Mattress', 'Baby Stroller', 'Baby High Chair']],
  ['plus-essential', 'plan', 'Plus Essential (1 RK)', 'Studio and 1 RK homes', 20, ['Single Bed with Storage', 'Single Orthopaedic Mattress', 'Study Table', 'Ergonomic Office Chair', 'Single Door Refrigerator 190L', 'Semi-Automatic Washing Machine 7kg']],
  ['plus-comfort', 'plan', 'Plus Comfort (1 BHK)', 'Full home furnishing for a 1 BHK', 20, ['Queen Bed with Storage', 'Queen Orthopaedic Mattress', '3-Door Wardrobe', '3-Seater Fabric Sofa', 'Double Door Refrigerator 260L', 'Front Load Washing Machine 7kg', '43" Smart LED TV']],
  ['plus-premium', 'plan', 'Plus Premium (2 BHK)', 'Full home furnishing for a 2 BHK', 20, ['King Bed with Storage', 'King Memory Foam Mattress', '3-Door Wardrobe', 'L-Shape Sofa', '6-Seater Dining Table Set', 'Double Door Refrigerator 350L', 'Front Load Washing Machine 8kg', '55" 4K Smart TV', '1.5 Ton 3 Star Inverter Split AC']]
];
const COMMENTS = ['Delivered on time and in great condition.', 'Good quality for the monthly price. Would rent again.', 'Setup was quick and the team was polite.', 'Works perfectly, no issues so far.',
  'Maintenance request was solved within a day.', 'Value for money, much better than buying.', 'Looks new and very comfortable.', 'Pickup was smooth when I moved out.'];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all(Object.values(M).map(m => m.deleteMany({})));
  await User.syncIndexes(); // email/referral indexes are sparse
  const pw = n => bcrypt.hashSync(n, 10);
  await User.create({ name: 'Admin', email: 'admin@rentease.com', password: pw('admin123'), role: 'admin' });
  const vendors = await User.insertMany([['City Rentals', 'vendor@rentease.com', 'Delhi'], ['Metro Homes', 'metro@rentease.com', 'Mumbai'], ['SouthStay Rentals', 'south@rentease.com', 'Bengaluru']]
    .map(([name, email, city], i) => ({ name, email, city, role: 'vendor', password: pw('vendor123'), phone: '981000' + (1000 + i * 111) })));
  const vendorFor = c => (['Mumbai', 'Pune'].includes(c) ? vendors[1] : ['Bengaluru', 'Hyderabad', 'Chennai'].includes(c) ? vendors[2] : vendors[0])._id;
  const kycOf = i => (i === 6 ? { status: 'pending', docType: 'aadhaar', docNumber: 'XXXX4821', submittedAt: ago(1) } : { status: 'verified', docType: i % 2 ? 'pan' : 'aadhaar', docNumber: 'XXXX' + (1200 + i * 137), submittedAt: ago(60) });
  const customers = await User.insertMany([['Demo User', 'user@rentease.com', 'Delhi'], ['Aarav Sharma', 'aarav@example.com', 'Noida'], ['Priya Nair', 'priya@example.com', 'Bengaluru'],
    ['Rohan Mehta', 'rohan@example.com', 'Mumbai'], ['Sneha Iyer', 'sneha@example.com', 'Pune'], ['Imran Khan', 'imran@example.com', 'Aligarh'],
    ['Kavya Reddy', 'kavya@example.com', 'Hyderabad'], ['Arjun Singh', 'arjun@example.com', 'Lucknow']]
    .map(([name, email, city], i) => ({ name, email, city, password: pw('user123'), phone: '98765' + (10000 + i * 1111), kyc: kycOf(i), credits: i === 0 ? 200 : 0, ...(i === 0 ? { referralCode: 'RENT200' } : {}) })));
  await Area.insertMany(C.map(([name, lat, lng]) => ({ name, lat, lng })));
  await Store.insertMany(C.flatMap(([city, lat, lng]) => AREAS[city].map((a, k) => ({ name: `RentEase Experience Store, ${a}`, city, address: `${a}, ${city}`, phone: '+91 98765 4' + (3210 + k * 111), hours: '10 am to 8 pm, all days',
    lat: lat + (k ? -0.04 : 0.03), lng: lng + (k ? 0.05 : -0.03) }))));

  const docs = [];
  C.forEach(([city], ci) => T.forEach((t, i) => {
    const m = mult[city] || 1, stock = 3 + ((i * 5 + ci * 3) % 8);
    docs.push({ sku: slug(t[0]), name: t[0], category: t[1], type: t[2], brand: t[5], capacity: capOf(t[0]), badge: badgeOf(i), image: photo(t[0]), city, vendor: vendorFor(city),
      description: `${t[0]}: quality-checked, delivered and set up by us, with free maintenance for the whole rental.`,
      monthlyRent: Math.round(t[3] * m / 10) * 10 - 1, securityDeposit: Math.round(t[4] * m / 100) * 100, tenureOptions: i % 3 === 0 ? [1, 3, 6, 9, 12] : [3, 6, 9, 12], stock, available: stock });
  }));
  const products = await Product.insertMany(docs);

  const skus = new Set(T.map(t => slug(t[0])));
  await Package.insertMany(PK.map(([s, kind, name, tagline, discountPercent, names]) => {
    names.forEach(n => { if (!skus.has(slug(n))) throw new Error('Package item not in catalog: ' + n); });
    return { slug: s, kind, name, tagline, discountPercent, skus: names.map(slug), features: kind === 'plan' ? FEAT : [] };
  }));
  await Coupon.insertMany([
    { code: 'FIRST10', description: '10% off your first month (up to ₹500)', type: 'percent', value: 10, minOrder: 500, maxDiscount: 500 },
    { code: 'WELCOME200', description: 'Flat ₹200 off on rentals above ₹1,000/month', type: 'flat', value: 200, minOrder: 1000 },
    { code: 'STUDENT150', description: 'Flat ₹150 off for students on rentals above ₹600/month', type: 'flat', value: 150, minOrder: 600 },
    { code: 'LONGSTAY15', description: '15% off the first month on rentals above ₹2,000/month (up to ₹1,000)', type: 'percent', value: 15, minOrder: 2000, maxDiscount: 1000 },
    { code: 'FESTIVE500', description: 'Flat ₹500 off on rentals above ₹3,000/month', type: 'flat', value: 500, minOrder: 3000 }
  ]);

  // sample orders so every dashboard has data
  const live = ['placed', 'scheduled', 'active', 'return_requested'];
  const specs = [ // customer, city, items, tenure, status, days since delivery (negative = upcoming), coupon, payment method
    [0, 'Delhi', 2, 6, 'active', 40, 'FIRST10', 'upi'], [1, 'Noida', 2, 12, 'active', 75, null, 'card'], [2, 'Bengaluru', 3, 6, 'active', 20, 'WELCOME200', 'upi'],
    [3, 'Mumbai', 2, 3, 'active', 55, null, 'netbanking'], [4, 'Pune', 1, 6, 'active', 33, null, 'upi'], [5, 'Aligarh', 2, 3, 'return_requested', 85, null, 'cod'],
    [6, 'Hyderabad', 2, 12, 'active', 100, 'STUDENT150', 'card'], [7, 'Lucknow', 1, 6, 'scheduled', -3, null, 'upi'], [0, 'Delhi', 1, 3, 'placed', -6, null, 'cod'],
    [1, 'Noida', 1, 3, 'returned', 150, null, 'upi'], [2, 'Bengaluru', 2, 6, 'returned', 220, null, 'card'], [3, 'Mumbai', 1, 3, 'damaged', 130, null, 'upi'],
    [4, 'Pune', 2, 3, 'returned', 160, null, 'upi'], [5, 'Aligarh', 1, 3, 'cancelled', 10, null, 'upi'], [2, 'Bengaluru', 1, 3, 'active', 12, null, 'upi']
  ];
  const orders = [];
  for (const [k, [ci, city, n, tenure, status, d, code, method]] of specs.entries()) {
    const pool = products.filter(p => p.city === city), picks = Array.from({ length: n }, (_, x) => pool[(k * 3 + x * 5) % pool.length]);
    const items = picks.map(p => ({ product: p._id, sku: p.sku, name: p.name, vendor: p.vendor, qty: 1, monthlyRent: rentFor(p.monthlyRent, tenure), deposit: p.securityDeposit, tenure }));
    const totalMonthly = items.reduce((s, i) => s + i.monthlyRent, 0), totalDeposit = items.reduce((s, i) => s + i.deposit, 0);
    const discount = code === 'FIRST10' ? Math.min(Math.round(totalMonthly * .1), 500) : code === 'WELCOME200' ? 200 : code === 'STUDENT150' ? 150 : 0;
    const deliveryDate = ago(d), delivered = ['active', 'return_requested', 'returned', 'damaged'].includes(status);
    const online = method !== 'cod' || delivered, paidMonths = !online ? 0 : delivered ? Math.min(tenure, Math.floor(d / 30) + 1) : 1;
    const o = await Order.create({ user: customers[ci]._id, items, city: city.toLowerCase(), deliveryDate, endDate: addM(deliveryDate, tenure), status, createdAt: ago(d + 2),
      address: `${10 + k}, Green Park Colony`, pincode: '110016', pickupDate: status === 'return_requested' ? ago(-4) : undefined, totalMonthly, totalDeposit, discount, couponCode: code || undefined,
      payable: totalMonthly + totalDeposit - discount, paymentMethod: method, paymentStatus: status === 'cancelled' ? 'refunded' : online ? 'paid' : 'pending', paidMonths: status === 'cancelled' ? 0 : paidMonths,
      damageCharge: status === 'damaged' ? 800 : 0 });
    orders.push(o);
    const st = status === 'cancelled' ? 'refunded' : online ? 'paid' : 'pending';
    await Payment.create({ user: o.user, order: o._id, amount: o.payable, type: 'initial', method, status: st, txnId: online ? 'TXN' + (100000 + k * 7919) : undefined, paidAt: ago(d + 2), createdAt: ago(d + 2) });
    for (let m = 1; m < paidMonths; m++) await Payment.create({ user: o.user, order: o._id, amount: totalMonthly, type: 'rent', method: 'upi', status: 'paid', txnId: 'TXN' + (200000 + k * 313 + m), paidAt: ago(d - m * 30), createdAt: ago(d - m * 30) });
    if (live.includes(status)) await Promise.all(items.map(i => Product.updateOne({ _id: i.product }, { $inc: { available: -1 } })));
  }
  const act = orders.filter(o => o.status === 'active');
  const MT = (o, description, status, hrs, d) => Maintenance.create({ user: o.user, order: o._id, vendor: o.items[0].vendor, description, status, createdAt: ago(d), resolvedAt: status === 'resolved' ? new Date(ago(d).getTime() + hrs * 36e5) : undefined });
  await MT(act[0], 'Refrigerator is not cooling properly.', 'resolved', 20, 12);
  await MT(act[1], 'Sofa cushion zip is broken.', 'resolved', 30, 25);
  await MT(act[2], 'Washing machine makes a loud noise during spin.', 'in_progress', 0, 2);
  await MT(act[3], 'TV remote is not working.', 'open', 0, 1);
  await MT(act[4], 'Wardrobe door hinge is loose.', 'resolved', 12, 6);
  const dmg = orders.find(o => o.status === 'damaged'), ret = orders.find(o => o.status === 'returned');
  await Dispute.create({ user: dmg.user, order: dmg._id, type: 'damage_claim', message: 'The scratch on the table was already there at delivery.' });
  await Dispute.create({ user: ret.user, order: ret._id, message: 'Deposit refund is still pending after return.', status: 'resolved', resolution: 'Refund issued in 5 working days.' });
  await Contact.insertMany([{ name: 'Neha Verma', email: 'neha@example.com', phone: '9811122233', message: 'Do you deliver to Noida Sector 62? I want a 1 BHK pack.' },
    { name: 'Karan Joshi', email: 'karan@example.com', message: 'Can I rent a laptop for just one month?' }, { name: 'Meera Das', email: 'meera@example.com', message: 'How do I extend my rental?', status: 'done' }]);
  await ServiceRequest.insertMany([
    { type: 'relocation', name: 'Vikram Rao', phone: '9822200011', city: 'Pune', details: { from: 'Pune', to: 'Bengaluru', home: '2 BHK', date: ago(-12).toISOString().slice(0, 10), estimate: 18750 } },
    { type: 'relocation', name: 'Anita Paul', phone: '9822200022', city: 'Delhi', details: { from: 'Delhi', to: 'Delhi', home: '1 BHK', date: ago(-5).toISOString().slice(0, 10), estimate: 4999 }, status: 'contacted' },
    { type: 'business', name: 'Sunrise Co-living', phone: '9822200033', email: 'ops@sunrise.example', city: 'Bengaluru', details: { company: 'Sunrise Co-living', units: 40, need: 'Beds, wardrobes and ACs for 40 rooms' } }]);

  const rv = [];
  T.slice(0, 50).forEach((t, i) => [0, 1, 2].forEach(j => { const u = customers[(i + j * 2) % customers.length]; rv.push({ sku: slug(t[0]), user: u._id, userName: u.name, rating: [5, 4, 5, 3, 4][(i + j) % 5], comment: COMMENTS[(i * 3 + j) % COMMENTS.length] }); }));
  await Review.insertMany(rv);
  for (const s of new Set(rv.map(r => r.sku))) {
    const list = rv.filter(r => r.sku === s);
    await Product.updateMany({ sku: s }, { ratingAvg: +(list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1), ratingCount: list.length });
  }
  const demoCity = products.filter(p => p.city === 'Delhi'), pick = n => demoCity.find(p => p.sku === slug(n))._id;
  await User.updateOne({ _id: customers[0]._id }, { wishlist: ['Queen Bed with Storage', 'Double Door Refrigerator 260L', '43" Smart LED TV', 'Motorised Treadmill'].map(pick),
    addresses: [{ label: 'Home', line: '12, Green Park Colony', city: 'Delhi', pincode: '110016' }, { label: 'Office', line: 'Tower B, Cyber Hub', city: 'Gurugram', pincode: '122002' }] });
  console.log(`Seeded ${products.length} listings (${T.length} items x ${C.length} cities), ${PK.length} packages and plans, 5 coupons, ${customers.length} customers, ${orders.length} orders, ${rv.length} reviews.`);
  console.log('Logins: admin@rentease.com/admin123 · vendor@rentease.com/vendor123 · user@rentease.com/user123 (phone 9876510000)');
  process.exit();
})().catch(e => { console.error(e); process.exit(1); });
