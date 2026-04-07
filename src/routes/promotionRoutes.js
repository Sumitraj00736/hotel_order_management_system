const express = require('express');
const { body } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { addPromotion, listPromotions } = require('../controllers/promotionController');

const router = express.Router();

router.use(auth, branchScope);

router.get('/me', requirePermission('staff:view'), (req, res) => listPromotions({ ...req, params: { id: req.user._id } }, res));
router.get('/:id', requirePermission('staff:view'), listPromotions);
router.post(
  '/:id',
  requirePermission('staff:edit'),
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
