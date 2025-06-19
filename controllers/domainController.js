const Domain = require('../models/Domains');
const TestResult = require('../models/TestResults');
const { APIError, asyncHandler } = require('../middleware/errorHandler');

/**
 * Get all domains for the authenticated user
 */
const getDomains = asyncHandler(async (req, res) => {
  const domains = await Domain.findByUserId(req.user.id);
  
  // Get latest test results for each domain
  const domainsWithTests = await Promise.all(
    domains.map(async (domain) => {
      const latestTests = await TestResult.getLatestByDomain(domain.id);
      return {
        ...domain,
        latest_tests: latestTests,
      };
    })
  );

  res.json({
    message: 'Domains retrieved successfully',
    domains: domainsWithTests,
    total: domainsWithTests.length,
  });
});

/**
 * Get a specific domain by ID
 */
const getDomainById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const domain = await Domain.findByIdAndUserId(id, req.user.id);
  
  if (!domain) {
    throw new APIError('Domain not found', 404);
  }

  // Get domain with latest test results
  const domainWithTests = await domain.getWithLatestTests();
  
  res.json({
    message: 'Domain retrieved successfully',
    domain: domainWithTests,
  });
});

/**
 * Add a new domain
 */
const addDomain = asyncHandler(async (req, res) => {
  const { domain_name } = req.body;
  
  // Check if domain already exists for this user
  const existingDomains = await Domain.findByUserId(req.user.id);
  const domainExists = existingDomains.some(
    d => d.domain_name.toLowerCase() === domain_name.toLowerCase()
  );
  
  if (domainExists) {
    throw new APIError('Domain already exists for this user', 409);
  }

  const domain = await Domain.create({
    user_id: req.user.id,
    domain_name: domain_name.toLowerCase(),
  });

  res.status(201).json({
    message: 'Domain added successfully',
    domain,
  });
});

/**
 * Update domain
 */
const updateDomain = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { domain_name } = req.body;
  
  const domain = await Domain.findByIdAndUserId(id, req.user.id);
  
  if (!domain) {
    throw new APIError('Domain not found', 404);
  }

  // If domain name is being updated, check for duplicates
  if (domain_name && domain_name.toLowerCase() !== domain.domain_name) {
    const existingDomains = await Domain.findByUserId(req.user.id);
    const domainExists = existingDomains.some(
      d => d.domain_name.toLowerCase() === domain_name.toLowerCase() && d.id !== domain.id
    );
    
    if (domainExists) {
      throw new APIError('Domain name already exists for this user', 409);
    }
  }

  const updateData = {};
  if (domain_name) {
    updateData.domain_name = domain_name.toLowerCase();
  }

  const updatedDomain = await domain.update(updateData);

  res.json({
    message: 'Domain updated successfully',
    domain: updatedDomain,
  });
});

/**
 * Delete domain (soft delete)
 */
const deleteDomain = asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const domain = await Domain.findByIdAndUserId(id, req.user.id);
  
  if (!domain) {
    throw new APIError('Domain not found', 404);
  }

  await domain.deactivate();

  res.json({
    message: 'Domain deleted successfully',
  });
});

/**
 * Get domain statistics
 */
const getDomainStats = asyncHandler(async (req, res) => {
  const domains = await Domain.findByUserId(req.user.id);
  
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  let pendingTests = 0;
  
  const testsByType = {
    dmarc: { total: 0, passed: 0, failed: 0 },
    spf: { total: 0, passed: 0, failed: 0 },
    dkim: { total: 0, passed: 0, failed: 0 },
    mail_echo: { total: 0, passed: 0, failed: 0 },
  };

  for (const domain of domains) {
    const tests = await TestResult.getLatestByDomain(domain.id);
    
    for (const test of tests) {
      totalTests++;
      
      if (test.status === 'completed') {
        if (test.score >= 70) {
          passedTests++;
          testsByType[test.test_type].passed++;
        } else {
          failedTests++;
          testsByType[test.test_type].failed++;
        }
      } else if (test.status === 'pending' || test.status === 'running') {
        pendingTests++;
      } else {
        failedTests++;
        testsByType[test.test_type].failed++;
      }
      
      testsByType[test.test_type].total++;
    }
  }

  res.json({
    message: 'Domain statistics retrieved successfully',
    stats: {
      total_domains: domains.length,
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: failedTests,
      pending_tests: pendingTests,
      pass_rate: totalTests > 0 ? Math.round((passedTests / totalTests) * 100) : 0,
      tests_by_type: testsByType,
    },
  });
});

module.exports = {
  getDomains,
  getDomainById,
  addDomain,
  updateDomain,
  deleteDomain,
  getDomainStats,
};