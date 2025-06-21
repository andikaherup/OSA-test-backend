// Test setup and global configuration
require('dotenv').config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DB_NAME = 'email_security_dashboard_test';
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'password123';

// Increase timeout for database operations
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  generateTestUser: () => ({
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    first_name: 'Test',
    last_name: 'User',
  }),

  generateTestDomain: () => `test-${Date.now()}.example.com`,

  // Helper to wait for async operations
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

// Mock console methods in tests to reduce noise
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});
