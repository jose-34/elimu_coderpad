const express = require('express');
const questionController = require('../controllers/questionController');

const router = express.Router();

router.get('/', questionController.list);

module.exports = router;
