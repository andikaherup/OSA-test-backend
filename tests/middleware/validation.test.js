const {
  isValidDomain,
  isValidEmail,
  sanitizeString,
  validateDomainInput,
  validateTestType,
  validateEmail,
} = require('../../middleware/validation');
const { ValidationError } = require('../../middleware/errorHandler');

describe('Validation Middleware', () => {
  describe('isValidDomain', () => {
    test('should validate correct domains', () => {
      expect(isValidDomain('example.com')).toBe(true);
      expect(isValidDomain('sub.example.com')).toBe(true);
      expect(isValidDomain('test-domain.co.uk')).toBe(true);
    });

    test('should reject invalid domains', () => {
      expect(isValidDomain('invalid')).toBe(false);
      expect(isValidDomain('')).toBe(false);
      expect(isValidDomain(null)).toBe(false);
      expect(isValidDomain(undefined)).toBe(false);
      expect(isValidDomain('.example.com')).toBe(false);
      expect(isValidDomain('example..com')).toBe(false);
    });

    test('should reject overly long domains', () => {
      const longDomain = 'a'.repeat(250) + '.com';
      expect(isValidDomain(longDomain)).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    test('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('test+tag@example.org')).toBe(true);
    });

    test('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
    });

    test('should reject overly long emails', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(isValidEmail(longEmail)).toBe(false);
    });
  });

  describe('sanitizeString', () => {
    test('should trim whitespace', () => {
      expect(sanitizeString('  test  ')).toBe('test');
    });

    test('should remove dangerous characters', () => {
      expect(sanitizeString('testscriptalert("xss")/script')).toBe(
        'testscriptalert("xss")/script'
      );

      expect(sanitizeString('test > value')).toBe('test  value');
    });

    test('should handle empty/null inputs', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString(null)).toBe('');
      expect(sanitizeString(undefined)).toBe('');
    });
  });

  describe('validateDomainInput middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {} };
      res = {};
      next = jest.fn();
    });

    test('should pass valid domain', () => {
      req.body.domain_name = 'example.com';

      validateDomainInput(req, res, next);

      expect(req.body.domain_name).toBe('example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should clean and lowercase domain', () => {
      req.body.domain_name = '  EXAMPLE.COM  ';

      validateDomainInput(req, res, next);

      expect(req.body.domain_name).toBe('example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should throw error for missing domain', () => {
      expect(() => validateDomainInput(req, res, next)).toThrow(
        ValidationError
      );
      expect(() => validateDomainInput(req, res, next)).toThrow(
        'Domain name is required'
      );
    });

    test('should throw error for invalid domain', () => {
      req.body.domain_name = 'invalid-domain';

      expect(() => validateDomainInput(req, res, next)).toThrow(
        ValidationError
      );
      expect(() => validateDomainInput(req, res, next)).toThrow(
        'Invalid domain name format'
      );
    });
  });

  describe('validateTestType middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {} };
      res = {};
      next = jest.fn();
    });

    test('should pass valid test types', () => {
      const validTypes = ['dmarc', 'spf', 'dkim', 'mail_echo'];

      validTypes.forEach((type) => {
        req.body.test_type = type;
        next.mockClear();

        validateTestType(req, res, next);
        expect(next).toHaveBeenCalled();
      });
    });

    test('should throw error for invalid test type', () => {
      req.body.test_type = 'invalid_type';

      expect(() => validateTestType(req, res, next)).toThrow(ValidationError);
    });

    test('should throw error for missing test type', () => {
      expect(() => validateTestType(req, res, next)).toThrow(ValidationError);
    });
  });

  describe('validateEmail middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {} };
      res = {};
      next = jest.fn();
    });

    test('should pass valid email', () => {
      req.body.email = 'test@example.com';

      validateEmail(req, res, next);

      expect(req.body.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should clean and lowercase email', () => {
      req.body.email = '  TEST@EXAMPLE.COM  ';

      validateEmail(req, res, next);

      expect(req.body.email).toBe('test@example.com');
      expect(next).toHaveBeenCalled();
    });

    test('should throw error for missing email', () => {
      expect(() => validateEmail(req, res, next)).toThrow(ValidationError);
      expect(() => validateEmail(req, res, next)).toThrow('Email is required');
    });

    test('should throw error for invalid email', () => {
      req.body.email = 'invalid-email';

      expect(() => validateEmail(req, res, next)).toThrow(ValidationError);
      expect(() => validateEmail(req, res, next)).toThrow(
        'Invalid email format'
      );
    });
  });
});
