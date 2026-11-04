require('dotenv').config();
const express = require('express'), cors = require('cors'), mongoose = require('mongoose');
const app = express();
app.use(cors()); app.use(express.json());
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/extras'));
app.use((err, req, res, next) => res.status(err.status || 500).json({ message: err.message || 'Server error' }));
mongoose.connect(process.env.MONGO_URI).then(() => {
  const port = process.env.PORT || 5000;
  app.listen(port, () => console.log('API running on port ' + port));
}).catch(e => { console.error('MongoDB connection failed:', e.message); process.exit(1); });
