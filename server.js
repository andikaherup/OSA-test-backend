const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');
const { testConnection } = require('./config/database');
const { execSync } = require('child_process');
const webSocketService = require('./services/websocketService');

// Import middleware
const {
  globalErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  errorLogger,
} = require('./middleware/errorHandler');
const { apiRateLimit } = require('./middleware/rateLimiter');

// Import routes
const authRoutes = require('./routes/auth');
const domainRoutes = require('./routes/domains');
const testRoutes = require('./routes/tests');

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Security and parsing middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3001',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request tracking
app.use(requestIdMiddleware);

// Rate limiting
app.use('/api', apiRateLimit);

// API Documentation
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpecs, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Email Security Dashboard API',
  })
);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/domains', domainRoutes);
app.use('/api/tests', testRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
  });
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Email Security Dashboard API',
    version: '1.0.0',
    description:
      'API for monitoring email security (DMARC, SPF, DKIM, Mail Echo)',
    endpoints: {
      auth: '/api/auth',
      domains: '/api/domains',
      tests: '/api/tests',
    },
    documentation: '/api/docs',
  });
});

// 404 handler for undefined routes
app.use('*', notFoundHandler);

// Error logging middleware
app.use(errorLogger);

// Global error handler
app.use(globalErrorHandler);

// Run database migrations
const runMigrations = async () => {
  try {
    console.log('Running database migrations...');
    execSync('npm run migrate:up', { stdio: 'inherit' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    throw error;
  }
};

// Test database connection with retry logic
const testConnectionWithRetry = async (maxRetries = 5) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const connected = await testConnection();
      if (connected) {
        return true;
      }
    } catch (error) {
      console.log(
        `Database connection attempt ${i + 1}/${maxRetries} failed:`,
        error.message
      );
    }

    if (i < maxRetries - 1) {
      console.log(`Retrying in 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  return false;
};

// Start server
const startServer = async () => {
  try {
    // Test database connection with retries
    const dbConnected = await testConnectionWithRetry();
    if (!dbConnected) {
      console.error('Failed to connect to database after retries. Exiting...');
      process.exit(1);
    }

    // Run migrations
    await runMigrations();

    // Initialize WebSocket service
    webSocketService.initialize(server);

    server.listen(PORT, () => {
      console.log(`🚀 Server is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('💥 Error starting server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

startServer();
