const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requireRole = require('../middleware/requireRole');
const validate = require('../middleware/validate');
const { listSubMenus, createSubMenu, updateSubMenu, deleteSubMenu } = require('../controllers/subMenuController');

const router = express.Router();
router.use(auth, branchScope, requireRole('admin'));

router.get('/', listSubMenus);
router.post('/', [body('name').notEmpty()], validate, createSubMenu);
router.put('/:id', [param('id').isMongoId()], validate, updateSubMenu);
router.delete('/:id', [param('id').isMongoId()], validate, deleteSubMenu);

module.exports = router;
