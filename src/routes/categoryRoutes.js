const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { listCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

const router = express.Router();
router.use(auth, branchScope);

router.get('/', requirePermission('menu:view'), listCategories);
router.post('/', requirePermission('menu:edit'), [body('name').notEmpty()], validate, createCategory);
router.put('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, updateCategory);
router.delete('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, deleteCategory);

module.exports = router;
