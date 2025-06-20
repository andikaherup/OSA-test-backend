const express = require('express');
const {
  runTest,
  getTestResult,
  getTestHistory,
  getPendingTests,
  retryTest,
} = require('../controllers/testController');
const { authenticateToken } = require('../middleware/auth');
const {
  validateTestType,
  validatePagination,
} = require('../middleware/validation');
const { testRateLimit } = require('../middleware/rateLimiter');

const router = express.Router();

// All test routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/tests/run:
 *   post:
 *     summary: Run email security test
 *     tags: [Tests]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain_id
 *               - test_type
 *             properties:
 *               domain_id:
 *                 type: integer
 *                 example: 1
 *                 description: ID of the domain to test
 *               test_type:
 *                 type: string
 *                 enum: [dmarc, spf, dkim, mail_echo]
 *                 example: spf
 *                 description: Type of email security test to run
 *     responses:
 *       201:
 *         description: Test started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 test:
 *                   $ref: '#/components/schemas/TestResult'
 *       409:
 *         description: Test already running for this domain and type
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/run', testRateLimit, validateTestType, runTest);

/**
 * @swagger
 * /api/tests/results/{testId}:
 *   get:
 *     summary: Get test result by ID
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test result ID
 *     responses:
 *       200:
 *         description: Test result retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 test:
 *                   $ref: '#/components/schemas/TestResult'
 *       404:
 *         description: Test result not found
 */
router.get('/results/:testId', getTestResult);

/**
 * @swagger
 * /api/tests/history:
 *   get:
 *     summary: Get test history with filtering and pagination
 *     tags: [Tests]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of results per page
 *       - in: query
 *         name: test_type
 *         schema:
 *           type: string
 *           enum: [dmarc, spf, dkim, mail_echo]
 *         description: Filter by test type
 *       - in: query
 *         name: domain_id
 *         schema:
 *           type: integer
 *         description: Filter by domain ID
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed]
 *         description: Filter by test status
 *     responses:
 *       200:
 *         description: Test history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TestResult'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     current_page:
 *                       type: integer
 *                     per_page:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     total_pages:
 *                       type: integer
 */
router.get('/history', validatePagination, getTestHistory);

/**
 * @swagger
 * /api/tests/pending:
 *   get:
 *     summary: Get all pending tests
 *     tags: [Tests]
 *     responses:
 *       200:
 *         description: Pending tests retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 tests:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TestResult'
 *                 total:
 *                   type: integer
 */
router.get('/pending', getPendingTests);

/**
 * @swagger
 * /api/tests/retry/{testId}:
 *   post:
 *     summary: Retry a failed test
 *     tags: [Tests]
 *     parameters:
 *       - in: path
 *         name: testId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Test result ID to retry
 *     responses:
 *       200:
 *         description: Test retry started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 test:
 *                   $ref: '#/components/schemas/TestResult'
 *       400:
 *         description: Only failed tests can be retried
 *       404:
 *         description: Test result not found
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/retry/:testId', testRateLimit, retryTest);

module.exports = router;
