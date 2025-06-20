const Domain = require('../models/Domains');
const TestResult = require('../models/TestResults');
const { APIError, asyncHandler } = require('../middleware/errorHandler');
const { spawn } = require('child_process');
const path = require('path');
const webSocketService = require('../services/websocketService');

/**
 * Run a test for a specific domain
 */
const runTest = asyncHandler(async (req, res) => {
  const { domain_id, test_type } = req.body;
  
  // Validate domain ownership
  const domain = await Domain.findByIdAndUserId(domain_id, req.user.id);
  if (!domain) {
    throw new APIError('Domain not found or access denied', 404);
  }

  // Check if there's already a pending or running test for this domain and type
  const existingTests = await TestResult.findByDomainId(domain_id, 5);
  const activeTest = existingTests.find(
    test => test.test_type === test_type && 
           (test.status === 'pending' || test.status === 'running')
  );

  if (activeTest) {
    throw new APIError(`A ${test_type} test is already running for this domain`, 409);
  }

  // Create new test result record
  const testResult = await TestResult.create({
    domain_id,
    test_type,
    status: 'pending',
  });

  // Start test execution asynchronously
  executeTest(testResult, domain.domain_name, req.user.id);

  // Send real-time notification
  webSocketService.sendTestStarted(req.user.id, testResult);

  res.status(201).json({
    message: 'Test started successfully',
    test: testResult,
  });
});

/**
 * Get test results by test ID
 */
const getTestResult = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  
  const testResult = await TestResult.findById(testId);
  
  if (!testResult) {
    throw new APIError('Test result not found', 404);
  }

  // Verify user owns the domain
  const domain = await Domain.findByIdAndUserId(testResult.domain_id, req.user.id);
  if (!domain) {
    throw new APIError('Access denied', 403);
  }

  res.json({
    message: 'Test result retrieved successfully',
    test: testResult,
  });
});

/**
 * Get test history for user
 */
const getTestHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, test_type, domain_id, status } = req.query;
  
  let tests;
  
  if (domain_id) {
    // Verify domain ownership
    const domain = await Domain.findByIdAndUserId(domain_id, req.user.id);
    if (!domain) {
      throw new APIError('Domain not found or access denied', 404);
    }
    tests = await TestResult.findByDomainId(domain_id, parseInt(limit));
  } else {
    tests = await TestResult.getHistoryByUserId(req.user.id, parseInt(limit));
  }

  // Apply filters
  if (test_type) {
    tests = tests.filter(test => test.test_type === test_type);
  }
  
  if (status) {
    tests = tests.filter(test => test.status === status);
  }

  // Implement pagination
  const startIndex = (parseInt(page) - 1) * parseInt(limit);
  const endIndex = startIndex + parseInt(limit);
  const paginatedTests = tests.slice(startIndex, endIndex);

  res.json({
    message: 'Test history retrieved successfully',
    tests: paginatedTests,
    pagination: {
      current_page: parseInt(page),
      per_page: parseInt(limit),
      total: tests.length,
      total_pages: Math.ceil(tests.length / parseInt(limit)),
    },
  });
});

/**
 * Get all pending tests (for processing)
 */
const getPendingTests = asyncHandler(async (req, res) => {
  const pendingTests = await TestResult.getPendingTests();
  
  res.json({
    message: 'Pending tests retrieved successfully',
    tests: pendingTests,
    total: pendingTests.length,
  });
});

/**
 * Retry a failed test
 */
const retryTest = asyncHandler(async (req, res) => {
  const { testId } = req.params;
  
  const testResult = await TestResult.findById(testId);
  
  if (!testResult) {
    throw new APIError('Test result not found', 404);
  }

  // Verify user owns the domain
  const domain = await Domain.findByIdAndUserId(testResult.domain_id, req.user.id);
  if (!domain) {
    throw new APIError('Access denied', 403);
  }

  if (testResult.status !== 'failed') {
    throw new APIError('Only failed tests can be retried', 400);
  }

  // Reset test status
  await testResult.update({
    status: 'pending',
    error_message: null,
    result: null,
    score: null,
    recommendations: null,
  });

  // Start test execution
  executeTest(testResult, domain.domain_name, req.user.id);

  res.json({
    message: 'Test retry started successfully',
    test: testResult,
  });
});

/**
 * Execute test asynchronously
 * @param {TestResult} testResult - Test result object
 * @param {string} domainName - Domain name to test
 * @param {number} userId - User ID for notifications
 */
const executeTest = async (testResult, domainName, userId) => {
  try {
    // Mark test as running
    await testResult.markAsRunning();
    
    // Send real-time update
    webSocketService.sendTestUpdate(userId, testResult);

    // Python script path
    const pythonScriptsPath = process.env.PYTHON_SCRIPTS_PATH || './python-scripts';
    const scriptPath = path.join(pythonScriptsPath, `${testResult.test_type}_test.py`);

    // Execute Python script
    const pythonProcess = spawn('python3', [scriptPath, domainName], {
      cwd: pythonScriptsPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', async (code) => {
      try {
        if (code === 0) {
          // Parse test results
          const result = JSON.parse(stdout);
          
          // Calculate score and recommendations
          const { score, recommendations } = calculateScoreAndRecommendations(
            testResult.test_type, 
            result
          );

          await testResult.markAsCompleted(result, score, recommendations);
          
          // Send real-time completion notification
          webSocketService.sendTestCompleted(userId, await TestResult.findById(testResult.id));
        } else {
          await testResult.markAsFailed(stderr || 'Test execution failed');
          
          // Send real-time failure notification
          webSocketService.sendTestFailed(userId, await TestResult.findById(testResult.id));
        }
      } catch (error) {
        console.error('Error processing test result:', error);
        await testResult.markAsFailed(`Error processing test result: ${error.message}`);
        
        // Send real-time failure notification
        webSocketService.sendTestFailed(userId, await TestResult.findById(testResult.id));
      }
    });

    pythonProcess.on('error', async (error) => {
      console.error('Python process error:', error);
      await testResult.markAsFailed(`Python execution error: ${error.message}`);
      
      // Send real-time failure notification
      webSocketService.sendTestFailed(userId, await TestResult.findById(testResult.id));
    });

  } catch (error) {
    console.error('Error executing test:', error);
    await testResult.markAsFailed(`Test execution error: ${error.message}`);
    
    // Send real-time failure notification
    webSocketService.sendTestFailed(userId, await TestResult.findById(testResult.id));
  }
};

/**
 * Calculate score and recommendations based on test type and results
 * @param {string} testType - Type of test
 * @param {Object} result - Test result data
 * @returns {Object} Score and recommendations
 */
const calculateScoreAndRecommendations = (testType, result) => {
  let score = 0;
  const recommendations = [];

  switch (testType) {
    case 'dmarc':
      if (result.record_found) {
        score += 50;
        if (result.policy === 'reject') {
          score += 30;
        } else if (result.policy === 'quarantine') {
          score += 20;
        } else {
          recommendations.push('Consider upgrading DMARC policy to "quarantine" or "reject"');
        }
        
        if (result.percentage === 100) {
          score += 20;
        } else {
          recommendations.push('Set DMARC percentage to 100% for full protection');
        }
      } else {
        recommendations.push('Implement DMARC record for email authentication');
      }
      break;

    case 'spf':
      if (result.record_found) {
        score += 60;
        if (result.includes_all && result.all_mechanism === '-all') {
          score += 40;
        } else if (result.includes_all && result.all_mechanism === '~all') {
          score += 20;
          recommendations.push('Consider upgrading SPF record to use "-all" for stricter policy');
        } else {
          recommendations.push('Add "all" mechanism to SPF record');
        }
      } else {
        recommendations.push('Implement SPF record to specify authorized mail servers');
      }
      break;

    case 'dkim':
      if (result.signatures_found && result.signatures_found.length > 0) {
        score += 80;
        if (result.all_signatures_valid) {
          score += 20;
        } else {
          recommendations.push('Fix invalid DKIM signatures');
        }
      } else {
        recommendations.push('Implement DKIM signing for email authentication');
      }
      break;

    case 'mail_echo':
      if (result.mx_records && result.mx_records.length > 0) {
        score += 50;
        if (result.smtp_connection_successful) {
          score += 30;
          if (result.supports_tls) {
            score += 20;
          } else {
            recommendations.push('Enable TLS support on mail server');
          }
        } else {
          recommendations.push('Fix mail server connectivity issues');
        }
      } else {
        recommendations.push('Configure MX records for mail delivery');
      }
      break;

    default:
      score = 0;
      recommendations.push('Unknown test type');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    recommendations,
  };
};

module.exports = {
  runTest,
  getTestResult,
  getTestHistory,
  getPendingTests,
  retryTest,
};