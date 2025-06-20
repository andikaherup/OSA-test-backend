const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Email Security Dashboard API',
      version: '1.0.0',
      description: 'API for monitoring email security protocols (DMARC, SPF, DKIM, Mail Echo)',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            email: { type: 'string', format: 'email', example: 'user@example.com' },
            first_name: { type: 'string', example: 'John' },
            last_name: { type: 'string', example: 'Doe' },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Domain: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            user_id: { type: 'integer', example: 1 },
            domain_name: { type: 'string', example: 'example.com' },
            is_active: { type: 'boolean', example: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        TestResult: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            domain_id: { type: 'integer', example: 1 },
            test_type: { 
              type: 'string', 
              enum: ['dmarc', 'spf', 'dkim', 'mail_echo'],
              example: 'spf'
            },
            status: { 
              type: 'string', 
              enum: ['pending', 'running', 'completed', 'failed'],
              example: 'completed'
            },
            result: { 
              type: 'object',
              description: 'Test-specific result data'
            },
            score: { type: 'integer', minimum: 0, maximum: 100, example: 85 },
            recommendations: { 
              type: 'array', 
              items: { type: 'string' },
              example: ['Enable DMARC policy', 'Use stricter SPF record']
            },
            error_message: { type: 'string', nullable: true },
            executed_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Validation error' },
            message: { type: 'string', example: 'Invalid input provided' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [
    './routes/*.js',
    './controllers/*.js',
  ],
};

const specs = swaggerJSDoc(options);

module.exports = specs;