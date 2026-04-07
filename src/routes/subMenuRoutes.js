const express = require('express');
const { body, param } = require('express-validator');
const auth = require('../middleware/auth');
const branchScope = require('../middleware/branchScope');
const requirePermission = require('../middleware/requirePermission');
const validate = require('../middleware/validate');
const { listSubMenus, createSubMenu, updateSubMenu, deleteSubMenu } = require('../controllers/subMenuController');

const router = express.Router();
router.use(auth, branchScope);

router.get('/', requirePermission('menu:view'), listSubMenus);
router.post('/', requirePermission('menu:edit'), [body('name').notEmpty()], validate, createSubMenu);
router.put('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, updateSubMenu);
router.delete('/:id', requirePermission('menu:edit'), [param('id').isMongoId()], validate, deleteSubMenu);

module.exports = router;
