const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const compression = require('compression');
const { buildCorsOptions } = require('./config/http/cors');
const { registerApiRoutes } = require('./routes');

const app = express();

app.use(cors(buildCorsOptions()));
app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Increased from 300 to 1000
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const skipRoutes = ['/api/push', '/api/notifications'];
      return skipRoutes.some(route => req.originalUrl.startsWith(route));
    }
  })
);
app.use(express.json());
app.use(morgan('dev'));

app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'hotel-order-backend' });
});

// Lightweight liveness/readiness probe
app.get('/healthz', (req, res) => {
  const mongoReady = mongoose.connection.readyState === 1; // 1 = connected
  res.status(mongoReady ? 200 : 503).json({
    status: mongoReady ? 'ok' : 'degraded',
    service: 'hotel-order-backend',
    mongo: mongoose.connection.readyState
  });
});

registerApiRoutes(app);

app.use((req, res) => {
  res.status(404).json({ message: 'Not Found' });
});

// Centralized error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = err.message || 'Server error';
  if (process.env.NODE_ENV !== 'production') {
    // Helpful in dev; avoids leaking details in prod
    console.error(err);
  }
  res.status(status).json({ message });
});

module.exports = app;
