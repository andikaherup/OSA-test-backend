/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable('domains', {
    id: {
      type: 'serial',
      primaryKey: true,
    },
    user_id: {
      type: 'integer',
      notNull: true,
      references: '"users"',
      onDelete: 'cascade',
    },
    domain_name: {
      type: 'varchar(255)',
      notNull: true,
    },
    is_active: {
      type: 'boolean',
      default: true,
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
  pgm.createIndex('domains', 'user_id');
  pgm.createIndex('domains', 'domain_name');
  
  // Unique constraint for user_id + domain_name
  pgm.addConstraint('domains', 'unique_user_domain', 'UNIQUE(user_id, domain_name)');
};

exports.down = (pgm) => {
  pgm.dropTable('domains');
};