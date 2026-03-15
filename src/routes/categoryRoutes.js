const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listCategories, createCategory, updateCategory, deleteCategory } = require('../controllers/categoryController');

const router = express.Router();
router.use(auth, branchScope, requireRole('admin'));

router.get('/', listCategories);
router.post('/', [body('name').notEmpty()], validate, createCategory);
router.put('/:id', [param('id').isMongoId()], validate, updateCategory);
router.delete('/:id', [param('id').isMongoId()], validate, deleteCategory);

module.exports = router;
