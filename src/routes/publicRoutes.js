const express = require('express');
const { getCafeBySlug } = require('../controllers/publicController');

const router = express.Router();

router.get('/cafes/:slug', getCafeBySlug);

module.exports = router;
