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

// Domain statistics
router.get('/stats', getDomainStats);

// Domain CRUD operations
router.get('/', getDomains);
router.get('/:id', getDomainById);
router.post('/', validateDomainInput, addDomain);
router.put('/:id', validateDomainInput, updateDomain);
router.delete('/:id', deleteDomain);

module.exports = router;