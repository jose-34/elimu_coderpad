const express = require('express');
const { requireAuth } = require('../middleware/auth');
const interviewController = require('../controllers/interviewController');
const assessmentController = require('../controllers/assessmentController');

const router = express.Router();

// Public: candidate joins via session code, no auth required.
router.get('/join/:sessionCode', interviewController.joinBySessionCode);

router.use(requireAuth);
router.post('/', interviewController.create);
router.get('/', interviewController.list);
router.get('/:id', interviewController.getById);
router.post('/:id/start', interviewController.start);
router.post('/:id/end', interviewController.end);

router.post('/:id/assessment/:questionId', assessmentController.scoreQuestion);
router.get('/:id/assessment/summary', assessmentController.getSummary);
router.put('/:id/assessment/final', assessmentController.updateFinal);

module.exports = router;
