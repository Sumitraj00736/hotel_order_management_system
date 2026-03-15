const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listCombos, createCombo, updateCombo, deleteCombo } = require('../controllers/comboController');

const router = express.Router();
router.use(auth, branchScope, requireRole('admin'));

router.get('/', listCombos);
router.post(
  '/',
  [
    body('name').notEmpty(),
    body('priceActual').isFloat({ min: 0 }),
    body('priceOffer').isFloat({ min: 0 }),
    body('items').isArray({ min: 1 }),
    body('items.*.menuItem').isMongoId(),
    body('items.*.quantity').isInt({ min: 1 }),
    body('items.*.unitPrice').isFloat({ min: 0 })
  ],
  validate,
  createCombo
);
router.put('/:id', [param('id').isMongoId()], validate, updateCombo);
router.delete('/:id', [param('id').isMongoId()], validate, deleteCombo);

module.exports = router;
