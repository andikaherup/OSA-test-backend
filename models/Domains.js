const { pool } = require('../config/database');

class Domain {
  constructor(domainData) {
    this.id = domainData.id;
    this.user_id = domainData.user_id;
    this.domain_name = domainData.domain_name;
    this.is_active = domainData.is_active;
    this.created_at = domainData.created_at;
    this.updated_at = domainData.updated_at;
  }

  // Create a new domain
  static async create(domainData) {
    const query = `
      INSERT INTO domains (user_id, domain_name)
      VALUES ($1, $2)
      RETURNING *
    `;
    
    try {
      const result = await pool.query(query, [
        domainData.user_id,
        domainData.domain_name,
      ]);
      
      return new Domain(result.rows[0]);
    } catch (error) {
      if (error.constraint === 'unique_user_domain') {
        throw new Error('Domain already exists for this user');
      }
      throw new Error(`Error creating domain: ${error.message}`);
    }
  }

  // Find domains by user ID
  static async findByUserId(userId) {
    const query = `
      SELECT * FROM domains 
      WHERE user_id = $1 AND is_active = true 
      ORDER BY created_at DESC
    `;
    
    try {
      const result = await pool.query(query, [userId]);
      return result.rows.map(row => new Domain(row));
    } catch (error) {
      throw new Error(`Error finding domains by user ID: ${error.message}`);
    }
  }

  // Find domain by ID and user ID (for authorization)
  static async findByIdAndUserId(id, userId) {
    const query = `
      SELECT * FROM domains 
      WHERE id = $1 AND user_id = $2 AND is_active = true
    `;
    
    try {
      const result = await pool.query(query, [id, userId]);
      
      if (result.rows.length === 0) {
        return null;
      }
      
      return new Domain(result.rows[0]);
    } catch (error) {
      throw new Error(`Error finding domain: ${error.message}`);
    }
  }

  // Update domain
  async update(updateData) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    // Build dynamic update query
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] !== undefined && key !== 'id' && key !== 'user_id') {
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
      UPDATE domains 
      SET ${fields.join(', ')}
      WHERE id = $${paramCount + 1}
      RETURNING *
    `;

    try {
      const result = await pool.query(query, values);
      
      if (result.rows.length === 0) {
        throw new Error('Domain not found');
      }

      // Update current instance
      Object.assign(this, result.rows[0]);
      return this;
    } catch (error) {
      throw new Error(`Error updating domain: ${error.message}`);
    }
  }

  // Soft delete domain
  async deactivate() {
    return this.update({ is_active: false });
  }

  // Get domain with latest test results
  async getWithLatestTests() {
    const query = `
      SELECT 
        d.*,
        COALESCE(
          json_agg(
            json_build_object(
              'test_type', tr.test_type,
              'status', tr.status,
              'score', tr.score,
              'executed_at', tr.executed_at
            )
            ORDER BY tr.created_at DESC
          ) FILTER (WHERE tr.id IS NOT NULL), 
          '[]'::json
        ) as latest_tests
      FROM domains d
      LEFT JOIN LATERAL (
        SELECT DISTINCT ON (test_type) *
        FROM test_results 
        WHERE domain_id = d.id 
        ORDER BY test_type, created_at DESC
      ) tr ON true
      WHERE d.id = $1
      GROUP BY d.id
    `;

    try {
      const result = await pool.query(query, [this.id]);
      
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting domain with tests: ${error.message}`);
    }
  }
}

module.exports = Domain;