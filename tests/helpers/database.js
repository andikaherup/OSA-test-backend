const { pool } = require('../../config/database');

/**
 * Test database helper functions
 */
class TestDatabase {
  
  /**
   * Clean all test data from database
   */
  static async cleanup() {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Delete in correct order to respect foreign key constraints
      await client.query('DELETE FROM test_results');
      await client.query('DELETE FROM domains');
      await client.query('DELETE FROM users WHERE email LIKE %test%');
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a test user
   */
  static async createTestUser(userData = {}) {
    const defaultUser = {
      email: `test-${Date.now()}@example.com`,
      password_hash: '$2b$12$test.hash.for.testing.purposes.only',
      first_name: 'Test',
      last_name: 'User'
    };

    const user = { ...defaultUser, ...userData };

    const query = `
      INSERT INTO users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, first_name, last_name, created_at
    `;

    const result = await pool.query(query, [
      user.email,
      user.password_hash,
      user.first_name,
      user.last_name
    ]);

    return result.rows[0];
  }

  /**
   * Create a test domain
   */
  static async createTestDomain(userId, domainData = {}) {
    const defaultDomain = {
      domain_name: `test-${Date.now()}.example.com`
    };

    const domain = { ...defaultDomain, ...domainData };

    const query = `
      INSERT INTO domains (user_id, domain_name)
      VALUES ($1, $2)
      RETURNING id, user_id, domain_name, created_at
    `;

    const result = await pool.query(query, [userId, domain.domain_name]);
    return result.rows[0];
  }

  /**
   * Create a test result
   */
  static async createTestResult(domainId, resultData = {}) {
    const defaultResult = {
      test_type: 'spf',
      status: 'completed',
      result: { score: 85, record_found: true },
      score: 85
    };

    const testResult = { ...defaultResult, ...resultData };

    const query = `
      INSERT INTO test_results (domain_id, test_type, status, result, score)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, domain_id, test_type, status, result, score, created_at
    `;

    const result = await pool.query(query, [
      domainId,
      testResult.test_type,
      testResult.status,
      JSON.stringify(testResult.result),
      testResult.score
    ]);

    return result.rows[0];
  }

  /**
   * Get user by email
   */
  static async getUserByEmail(email) {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  /**
   * Get domain by ID
   */
  static async getDomainById(id) {
    const query = 'SELECT * FROM domains WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Get test result by ID
   */
  static async getTestResultById(id) {
    const query = 'SELECT * FROM test_results WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0];
  }

  /**
   * Count records in table
   */
  static async countRecords(tableName) {
    const query = `SELECT COUNT(*) as count FROM ${tableName}`;
    const result = await pool.query(query);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = TestDatabase;