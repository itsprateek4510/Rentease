require('dotenv').config();
const mongoose = require('mongoose');
if (!process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' && (process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'change_this_secret'))) throw new Error('Set a strong JWT_SECRET before starting the API');
const app = require('./app');
mongoose.connect(process.env.MONGO_URI).then(async () => {
  await Promise.all(Object.values(mongoose.models).map(m => m.init()));
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log('API running on port ' + port));
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
