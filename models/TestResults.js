const { pool } = require('../config/database');

class TestResult {
  constructor(testData) {
    this.id = testData.id;
    this.domain_id = testData.domain_id;
    this.test_type = testData.test_type;
    this.status = testData.status;
    this.result = testData.result;
    this.score = testData.score;
    this.recommendations = testData.recommendations;
    this.error_message = testData.error_message;
    this.executed_at = testData.executed_at;
    this.created_at = testData.created_at;
    this.updated_at = testData.updated_at;
  }

  // Create a new test result
  static async create(testData) {
    const query = `
      INSERT INTO test_results (domain_id, test_type, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        testData.domain_id,
        testData.test_type,
        testData.status || 'pending',
      ]);
      
      return new TestResult(result.rows[0]);
    } catch (error) {
      throw new Error(`Error creating test result: ${error.message}`);
    }
  }

  // Find test results by domain ID
  static async findByDomainId(domainId, limit = 50) {
    const query = `
      SELECT tr.*, d.domain_name 
      FROM test_results tr
      JOIN domains d ON tr.domain_id = d.id
      WHERE tr.domain_id = $1 
      ORDER BY tr.created_at DESC
      LIMIT $2
    `;
    
    try {
      const result = await pool.query(query, [domainId, limit]);
      return result.rows.map(row => new TestResult(row));
    } catch (error) {
      throw new Error(`Error finding test results: ${error.message}`);
    }
  }

  // Find test result by ID
  static async findById(id) {
    const query = `
      SELECT tr.*, d.domain_name, d.user_id
      FROM test_results tr
      JOIN domains d ON tr.domain_id = d.id
      WHERE tr.id = $1
    `;
    
    try {
      const result = await pool.query(query, [id]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new TestResult(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding test result: ${error.message}`);
    }
  }

  // Update test result
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== 'id' && key !== 'domain_id') {
        fields.push(`${key} = $${paramCount}`);
        values.push(updateData[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    // Add updated_at timestamp
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());
    values.push(this.id);

    const query = `
      UPDATE test_results 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Test result not found');
      }

      // Update current instance
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw new Error(`Error updating test result: ${error.message}`);
    }
  }

  // Mark test as running
  async markAsRunning() {
    return this.update({ 
      status: 'running',
      executed_at: new Date()
    });
  }

  // Mark test as completed with results
  async markAsCompleted(testResult, score, recommendations = []) {
    return this.update({
      status: 'completed',
      result: testResult,
      score,
      recommendations,
      error_message: null
    });
  }

  // Mark test as failed
  async markAsFailed(errorMessage) {
    return this.update({
      status: 'failed',
      error_message: errorMessage
    });
  }

  // Get latest test results for each test type by domain
  static async getLatestByDomain(domainId) {
    const query = `
      SELECT DISTINCT ON (test_type) *
      FROM test_results
      WHERE domain_id = $1
      ORDER BY test_type, created_at DESC
    `;

    try {
      const result = await pool.query(query, [domainId]);
      return result.rows.map(row => new TestResult(row));
    } catch (error) {
      throw new Error(`Error getting latest test results: ${error.message}`);
    }
  }

  // Get test history for a user (across all domains)
  static async getHistoryByUserId(userId, limit = 100) {
    const query = `
      SELECT tr.*, d.domain_name
      FROM test_results tr
      JOIN domains d ON tr.domain_id = d.id
      WHERE d.user_id = $1
      ORDER BY tr.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await pool.query(query, [userId, limit]);
      return result.rows.map(row => new TestResult(row));
    } catch (error) {
      throw new Error(`Error getting test history: ${error.message}`);
    }
  }

  // Get pending tests (for processing)
  static async getPendingTests() {
    const query = `
      SELECT tr.*, d.domain_name, d.user_id
      FROM test_results tr
      JOIN domains d ON tr.domain_id = d.id
      WHERE tr.status = 'pending'
      ORDER BY tr.created_at ASC
    `;

    try {
      const result = await pool.query(query);
      return result.rows.map(row => new TestResult(row));
    } catch (error) {
      throw new Error(`Error getting pending tests: ${error.message}`);
    }
  }
}

module.exports = TestResult;