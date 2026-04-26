const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const compression = require('compression');
const { buildCorsOptions } = require('./config/http/cors');
const { registerApiRoutes } = require('./routes');
const requestContext = require('./middleware/requestContext');

// Ensure future finance collections are registered with Mongoose (scalable schemas).
require('./models/finance/JournalVoucher');
require('./models/finance/CashBankAccount');
require('./models/finance/DaybookSession');

const app = express();

app.use(requestContext);
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
app.use(
  morgan((tokens, req, res) =>
    JSON.stringify({
      ts: new Date().toISOString(),
      level: 'info',
      type: 'http',
      requestId: req.requestId,
      method: tokens.method(req, res),
      path: tokens.url(req, res),
      status: Number(tokens.status(req, res)),
      responseTimeMs: Number(tokens['response-time'](req, res)),
      contentLength: tokens.res(req, res, 'content-length') || '0'
    })
  )
);

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

  if (req.log) {
    req.log.error('Unhandled request error', {
      status,
      error: err
    });
  } else {
    console.error('[Global Error Handler]:', {
      status,
      message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method
    });
  }

  res.status(status).json({ message, requestId: req.requestId });
});

module.exports = app;
