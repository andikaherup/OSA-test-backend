/**
 * Validate domain name format
 * @param {string} domain - Domain name to validate
 * @returns {boolean} True if domain is valid
 */
const isValidDomain = (domain) => {
  if (!domain || typeof domain !== 'string') {
    return false;
  }

  // Basic domain regex pattern
  const domainRegex =
    /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return domainRegex.test(domain) && domain.length <= 253;
};

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Sanitize string input
 * @param {string} input - Input to sanitize
 * @returns {string} Sanitized input
 */
const sanitizeString = (input) => {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input.trim().replace(/[<>]/g, '');
};

/**
 * Middleware to validate domain input
 */
const validateDomainInput = (req, res, next) => {
  const { domain_name } = req.body;

  if (!domain_name) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Domain name is required',
    });
  }

  const sanitizedDomain = sanitizeString(domain_name).toLowerCase();

  if (!isValidDomain(sanitizedDomain)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Invalid domain name format',
    });
  }

  // Add sanitized domain back to request
  req.body.domain_name = sanitizedDomain;
  next();
};

/**
 * Middleware to validate test type
 */
const validateTestType = (req, res, next) => {
  const { test_type } = req.body;
  const validTestTypes = ['dmarc', 'spf', 'dkim', 'mail_echo'];

  if (!test_type) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Test type is required',
    });
  }

  if (!validTestTypes.includes(test_type)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Invalid test type. Valid types: ${validTestTypes.join(', ')}`,
    });
  }

  next();
};

/**
 * Middleware to validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Page must be a positive integer',
    });
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Limit must be between 1 and 100',
    });
  }

  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  };

  next();
};

module.exports = {
  isValidDomain,
  isValidEmail,
  sanitizeString,
  validateDomainInput,
  validateTestType,
  validatePagination,
};
