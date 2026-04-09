const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const compression = require('compression');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const menuRoutes = require('./routes/menuRoutes');
const tableRoutes = require('./routes/tableRoutes');
const orderRoutes = require('./routes/orderRoutes');
const reportRoutes = require('./routes/reportRoutes');
const billRoutes = require('./routes/billRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const taxRoutes = require('./routes/taxRoutes');
const activityLogRoutes = require('./routes/activityLogRoutes');
const profileRoutes = require('./routes/profileRoutes');
const promotionRoutes = require('./routes/promotionRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const guestRoutes = require('./routes/guestRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const subMenuRoutes = require('./routes/subMenuRoutes');
const addOnRoutes = require('./routes/addOnRoutes');
const comboRoutes = require('./routes/comboRoutes');
const publicRoutes = require('./routes/publicRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const roleRoutes = require('./routes/roleRoutes');
const billingRoutes = require('./routes/billingRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const supportRoutes = require('./routes/supportRoutes');
const spaceRoutes = require('./routes/spaceRoutes');
const qrCodeRoutes = require('./routes/qrCodeRoutes');

const app = express();

const defaultOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://hoteloms.netlify.app',
  'https://hotel-order-management-system.onrender.com'
];
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const origins = allowedOrigins.length > 0 ? allowedOrigins : defaultOrigins;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origins.includes(origin)) {
        return callback(null, true);
      }
      // In production, block unknown origins instead of failing open
      if (process.env.NODE_ENV === 'production') {
        return callback(new Error('Not allowed by CORS'));
      }
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-branch-id'],
    credentials: true
  })
);
app.use(helmet());
app.use(compression());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false
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

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menus', menuRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/promotions', promotionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/guest', guestRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/submenus', subMenuRoutes);
app.use('/api/addons', addOnRoutes);
app.use('/api/combos', comboRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/spaces', spaceRoutes);
app.use('/api/qr-codes', qrCodeRoutes);
app.use('/api/public', publicRoutes);

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
