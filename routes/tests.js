const express = require('express');
const {
  runTest,
  getTestResult,
  getTestHistory,
  getPendingTests,
  retryTest,
} = require('../controllers/testController');
const { authenticateToken } = require('../middleware/auth');
const { validateTestType, validatePagination } = require('../middleware/validation');
const { testRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// All test routes require authentication
router.use(authenticateToken);

// Test execution (with rate limiting)
router.post('/run', testRateLimit, validateTestType, runTest);

// Test results and history
router.get('/results/:testId', getTestResult);
router.get('/history', validatePagination, getTestHistory);
router.get('/pending', getPendingTests);

// Test management
router.post('/retry/:testId', testRateLimit, retryTest);

module.exports = router;