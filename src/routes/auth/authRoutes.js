const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { register, login, firebaseLogin } = require('../../controllers/auth/authController');
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
    body('identifier').optional().isString()
  ],
  validate,
  login
);

router.post('/firebase-login', loginLimiter, firebaseLogin);

module.exports = router;
