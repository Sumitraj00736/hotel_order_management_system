const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, firebaseLogin, forgotPassword, resetPassword, checkPhone, refresh } = require('../../controllers/auth/authController');
const validate = require('../../middleware/validate');

const router = express.Router();

// Tighter login limiter to slow brute force attempts
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' }
});

router.post(
  '/register',
  [
    body('name').optional().isString(),
    body('email').isEmail(),
    body('phone').optional().isString().trim(),
    body('password').optional().isLength({ min: 6 })
  ],
  validate,
  register
);

router.post(
  '/login',
  loginLimiter,
  [
    body('password').notEmpty(),
    body('email').optional().isEmail(),
    body('phone').optional().isString(),
    body('identifier').optional().isString(),
    body().custom((value) => {
      if (value?.email || value?.phone || value?.identifier) return true;
      throw new Error('Email, phone, or identifier is required');
    })
  ],
  validate,
  login
);

router.post(
  '/firebase-login',
  loginLimiter,
  [body('idToken').notEmpty()],
  validate,
  firebaseLogin
);

router.post(
  '/forgot-password',
  loginLimiter,
  [body('email').isEmail()],
  validate,
  forgotPassword
);

router.post(
  '/reset-password',
  loginLimiter,
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 6 })
  ],
  validate,
  resetPassword
);

router.post('/check-phone', loginLimiter, [body('phone').notEmpty()], validate, checkPhone);
router.post('/refresh', [body('refreshToken').notEmpty()], validate, refresh);

module.exports = router;
