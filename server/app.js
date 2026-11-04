const express = require('express'), cors = require('cors'), helmet = require('helmet');
const cookieParser = require('cookie-parser');
const app = express();
const origins = () => (process.env.CLIENT_URL || 'http://localhost:5175').split(',').map(x => x.trim());
app.use(helmet());
app.use(cors({ origin: (origin, cb) => cb(null, !origin || origins().includes(origin)), credentials: true }));
app.use(express.json({ limit: '100kb' })); app.use(cookieParser());
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && !origins().includes(req.headers.origin)) return res.status(403).json({ message: 'Untrusted request origin' });
  next();
});
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); }, require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api', require('./routes/admin'));
app.use('/api', require('./routes/extras'));
app.use((req, res) => res.status(404).json({ message: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  const status = err.code === 11000 || err.name === 'VersionError' ? 409 : ['ValidationError', 'CastError'].includes(err.name) ? 400 : err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error. Please try again.' : err.code === 11000 ? 'That value is already in use' : err.name === 'VersionError' ? 'This record changed. Please reload and try again.' : err.message || 'Server error' });
});
module.exports = app;
