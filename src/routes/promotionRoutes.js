const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { addPromotion, listPromotions } = require('../controllers/promotionController');

const router = express.Router();

router.use(auth);

router.get('/me', (req, res) => listPromotions({ ...req, params: { id: req.user._id } }, res));
router.get('/:id', requireRole('admin'), listPromotions);
router.post(
  '/:id',
  requireRole('admin'),
  [
    body('title').notEmpty(),
    body('amount').optional().isFloat({ min: 0 }),
    body('effectiveDate').isISO8601(),
    body('note').optional().isString().isLength({ max: 500 })
  ],
  validate,
  addPromotion
);

module.exports = router;
