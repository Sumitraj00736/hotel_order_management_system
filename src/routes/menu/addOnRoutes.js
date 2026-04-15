const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../../middleware/auth');
const branchScope = require('../../middleware/branchScope');
const requirePermission = require('../../middleware/requirePermission');
const validate = require('../../middleware/validate');
const { listAddOns, createAddOn, updateAddOn, deleteAddOn } = require('../../controllers/menu/addOnController');

const router = express.Router();
router.use(auth, branchScope);

router.get('/', requirePermission('menu:view'), listAddOns);
router.post('/', requirePermission('menu:edit'), [body('name').notEmpty(), body('price').isFloat({ min: 0 })], validate, createAddOn);
router.put('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, updateAddOn);
router.delete('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, deleteAddOn);

module.exports = router;
