const { ValidationError } = require('./errorHandler');

/**
 * Validate domain name format
 */
const isValidDomain = (domain) => {
  if (!domain || typeof domain !== 'string') return false;
  
  const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return domainRegex.test(domain) && domain.length <= 253 && domain.includes('.');
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

/**
 * Sanitize string input
 */
const sanitizeString = (input) => {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '');
};

/**
 * Domain validation middleware
 */
const validateDomainInput = (req, res, next) => {
  const { domain_name } = req.body;

  if (!domain_name) {
    throw new ValidationError('Domain name is required');
  }

  const cleanDomain = sanitizeString(domain_name).toLowerCase();

  if (!isValidDomain(cleanDomain)) {
    throw new ValidationError('Invalid domain name format');
  }

  req.body.domain_name = cleanDomain;
  next();
};

/**
 * Test type validation middleware
 */
const validateTestType = (req, res, next) => {
  const { test_type } = req.body;
  const validTypes = ['dmarc', 'spf', 'dkim', 'mail_echo'];

  if (!test_type || !validTypes.includes(test_type)) {
    throw new ValidationError(`Test type must be one of: ${validTypes.join(', ')}`);
  }

  next();
};

/**
 * Pagination validation middleware
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 20 } = req.query;

  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  if (isNaN(pageNum) || pageNum < 1) {
    throw new ValidationError('Page must be a positive integer');
  }

  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    throw new ValidationError('Limit must be between 1 and 100');
  }

  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  };

  next();
};

/**
 * Email validation middleware
 */
const validateEmail = (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    throw new ValidationError('Email is required');
  }

  const cleanEmail = sanitizeString(email).toLowerCase();

  if (!isValidEmail(cleanEmail)) {
    throw new ValidationError('Invalid email format');
  }

  req.body.email = cleanEmail;
  next();
};

/**
 * Password validation middleware
 */
const validatePasswordMiddleware = (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    throw new ValidationError('Password is required');
  }

  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  next();
};

/**
 * Name validation middleware
 */
const validateNames = (req, res, next) => {
  const { first_name, last_name } = req.body;

  if (first_name !== undefined) {
    const cleanName = sanitizeString(first_name);
    if (cleanName.length < 1 || cleanName.length > 50) {
      throw new ValidationError('First name must be between 1 and 50 characters');
    }
    req.body.first_name = cleanName;
  }

  if (last_name !== undefined) {
    const cleanName = sanitizeString(last_name);
    if (cleanName.length < 1 || cleanName.length > 50) {
      throw new ValidationError('Last name must be between 1 and 50 characters');
    }
    req.body.last_name = cleanName;
  }

  next();
};

module.exports = {
  isValidDomain,
  isValidEmail,
  sanitizeString,
  validateDomainInput,
  validateTestType,
  validatePagination,
  validateEmail,
  validatePasswordMiddleware,
  validateNames,
};