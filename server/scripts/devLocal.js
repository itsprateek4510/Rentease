// Persistent, single-node replica set for development; never resets or seeds data.
require('dotenv').config();
const path = require('path'), fs = require('fs');
const mongoose = require('mongoose');
const { MongoMemoryReplSet } = require('mongodb-memory-server');
async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('dev:local is for local development only');
  const dbPath = path.join(__dirname, '..', '.local-data', 'mongo');
  fs.mkdirSync(dbPath, { recursive: true });
  const mongo = await MongoMemoryReplSet.create({ instanceOpts: [{ port: 27017, dbPath }], replSet: { count: 1, storageEngine: 'wiredTiger', name: 'rentease-local' } });
  const uri = mongo.getUri('rentease');
  process.env.MONGO_URI = uri;
  if (!process.env.JWT_SECRET) process.env.JWT_SECRET = require('crypto').randomBytes(48).toString('hex');
  await mongoose.connect(uri);
  const app = require('../app');
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
  const server = app.listen(process.env.PORT || 5000, () => console.log(`API running on port ${process.env.PORT || 5000}; MongoDB: ${uri}. Existing data is preserved.`));
  let stopping = false;
  const stop = async () => {
    if (stopping) return; stopping = true;
    server.close(); await mongoose.disconnect(); await mongo.stop({ doCleanup: false }); process.exit(0);
  };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
main().catch(e => { console.error(e.message); process.exit(1); });
