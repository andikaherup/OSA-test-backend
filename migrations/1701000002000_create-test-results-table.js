/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  // Create enum for test types
  pgm.createType('test_type', ['dmarc', 'spf', 'dkim', 'mail_echo']);
  
  // Create enum for test status
  pgm.createType('test_status', ['pending', 'running', 'completed', 'failed']);

  pgm.createTable('test_results', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    domain_id: {
      type: 'integer',
      notNull: true,
      references: '"domains"',
      onDelete: 'cascade',
    },
    test_type: {
      type: 'test_type',
      notNull: true,
    },
    status: {
      type: 'test_status',
      notNull: true,
      default: 'pending',
    },
    result: {
      type: 'jsonb',
      comment: 'Stores the detailed test results',
    },
    score: {
      type: 'integer',
      comment: 'Score from 0-100 for the test result',
    },
    recommendations: {
      type: 'text[]',
      comment: 'Array of recommendations for improvement',
    },
    error_message: {
      type: 'text',
      comment: 'Error message if test failed',
    },
    executed_at: {
      type: 'timestamp',
      comment: 'When the test was actually executed',
    },
    created_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      default: pgm.func('current_timestamp'),
    },
  });

  // Create indexes
  pgm.createIndex('test_results', 'domain_id');
  pgm.createIndex('test_results', 'test_type');
  pgm.createIndex('test_results', 'status');
  pgm.createIndex('test_results', 'created_at');
};

exports.down = (pgm) => {
  pgm.dropTable('test_results');
  pgm.dropType('test_status');
  pgm.dropType('test_type');
};