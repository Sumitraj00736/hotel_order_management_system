const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listAddOns, createAddOn, updateAddOn, deleteAddOn } = require('../controllers/addOnController');

const router = express.Router();
router.use(auth, branchScope, requireRole('admin'));

router.get('/', listAddOns);
router.post('/', [body('name').notEmpty(), body('price').isFloat({ min: 0 })], validate, createAddOn);
router.put('/:id', [param('id').isMongoId()], validate, updateAddOn);
router.delete('/:id', [param('id').isMongoId()], validate, deleteAddOn);

module.exports = router;
