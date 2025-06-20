const express = require('express');
const {
  getDomains,
  getDomainById,
  addDomain,
  updateDomain,
  deleteDomain,
  getDomainStats,
} = require('../controllers/domainController');
const { authenticateToken } = require('../middleware/auth');
const { validateDomainInput } = require('../middleware/validation');

const router = express.Router();

// All domain routes require authentication
router.use(authenticateToken);

/**
 * @swagger
 * /api/domains/stats:
 *   get:
 *     summary: Get domain statistics
 *     tags: [Domains]
 *     responses:
 *       200:
 *         description: Domain statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 stats:
 *                   type: object
 *                   properties:
 *                     total_domains:
 *                       type: integer
 *                     total_tests:
 *                       type: integer
 *                     passed_tests:
 *                       type: integer
 *                     failed_tests:
 *                       type: integer
 *                     pending_tests:
 *                       type: integer
 *                     pass_rate:
 *                       type: integer
 *                     tests_by_type:
 *                       type: object
 */
router.get('/stats', getDomainStats);

/**
 * @swagger
 * /api/domains:
 *   get:
 *     summary: Get all domains for authenticated user
 *     tags: [Domains]
 *     responses:
 *       200:
 *         description: Domains retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 domains:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Domain'
 *                       - type: object
 *                         properties:
 *                           latest_tests:
 *                             type: array
 *                             items:
 *                               $ref: '#/components/schemas/TestResult'
 *                 total:
 *                   type: integer
 */
router.get('/', getDomains);

/**
 * @swagger
 * /api/domains/{id}:
 *   get:
 *     summary: Get specific domain by ID
 *     tags: [Domains]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       200:
 *         description: Domain retrieved successfully
 *       404:
 *         description: Domain not found
 */
router.get('/:id', getDomainById);

/**
 * @swagger
 * /api/domains:
 *   post:
 *     summary: Add a new domain
 *     tags: [Domains]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - domain_name
 *             properties:
 *               domain_name:
 *                 type: string
 *                 example: example.com
 *                 description: Valid domain name
 *     responses:
 *       201:
 *         description: Domain added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 domain:
 *                   $ref: '#/components/schemas/Domain'
 *       409:
 *         description: Domain already exists
 */
router.post('/', validateDomainInput, addDomain);

/**
 * @swagger
 * /api/domains/{id}:
 *   put:
 *     summary: Update domain
 *     tags: [Domains]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               domain_name:
 *                 type: string
 *                 example: updated-example.com
 *     responses:
 *       200:
 *         description: Domain updated successfully
 *       404:
 *         description: Domain not found
 */
router.put('/:id', validateDomainInput, updateDomain);

/**
 * @swagger
 * /api/domains/{id}:
 *   delete:
 *     summary: Delete domain (soft delete)
 *     tags: [Domains]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Domain ID
 *     responses:
 *       200:
 *         description: Domain deleted successfully
 *       404:
 *         description: Domain not found
 */
router.delete('/:id', deleteDomain);

module.exports = router;
