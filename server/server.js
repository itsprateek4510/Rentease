require('dotenv').config();

const mongoose = require('mongoose');
const app = require('./app');

if (
  !process.env.JWT_SECRET ||
  (process.env.NODE_ENV === 'production' &&
    (process.env.JWT_SECRET.length < 32 ||
      process.env.JWT_SECRET === 'change_this_secret'))
) {
  throw new Error('Set a strong JWT_SECRET before starting the API');
}

let connectionPromise;

async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(process.env.MONGO_URI)
      .then(async () => {
        await Promise.all(
          Object.values(mongoose.models).map(model => model.init())
        );
      })
      .catch(error => {
        connectionPromise = null;
        throw error;
      });
  }

  await connectionPromise;
}

async function handler(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Backend error:', error);
    return res.status(500).json({
      message: 'Internal server error'
    });
  }
}

if (require.main === module) {
  const port = process.env.PORT || 5000;

  handler.listen
    ? handler.listen(port)
    : app.listen(port, async () => {
        try {
          await connectDB();
          console.log(`API running on port ${port}`);
        } catch (error) {
          console.error(error);
          process.exit(1);
        }
      });
} else {
  module.exports = handler;
}
