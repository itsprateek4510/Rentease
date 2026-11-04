/**
 * Applies the local product photos from server/productImages.json to listings
 * that already exist in the database, without wiping orders/users.
 *
 * Usage (from the server folder):
 *   node scripts/updateProductImages.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Product } = require('../models');
const IMAGES = require('../productImages.json');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  let changed = 0;
  const missing = [];
  for (const [name, image] of Object.entries(IMAGES)) {
    const r = await Product.updateMany({ name }, { $set: { image } });
    if (!r.matchedCount) missing.push(name);
    changed += r.modifiedCount;
  }
  console.log(`Updated ${changed} listings to local product photos.`);
  if (missing.length) console.log('No listings found for:\n  ' + missing.join('\n  '));
  await mongoose.disconnect();
})().catch(e => { console.error(e); process.exit(1); });
