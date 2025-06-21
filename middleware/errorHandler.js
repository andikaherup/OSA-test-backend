/**
 * Custom error classes for different types of application errors
 */
class APIError extends Error {
  constructor(
    message,
    statusCode = 500,
    isOperational = true,
    errorCode = null
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.name = 'APIError';

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends APIError {
  constructor(message, details = []) {
    super(message, 400, true, 'VALIDATION_ERROR');
    this.details = details;
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends APIError {
  constructor(message = 'Authentication failed') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends APIError {
  constructor(message = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends APIError {
  constructor(message = 'Resource not found') {
    super(message, 404, true, 'NOT_FOUND_ERROR');
    this.name = 'NotFoundError';
  }
}

class ConflictError extends APIError {
  constructor(message = 'Resource conflict') {
    super(message, 409, true, 'CONFLICT_ERROR');
    this.name = 'ConflictError';
  }
}

class RateLimitError extends APIError {
  constructor(message = 'Rate limit exceeded') {
    super(message, 429, true, 'RATE_LIMIT_ERROR');
    this.name = 'RateLimitError';
  }
}

class DatabaseError extends APIError {
  constructor(message = 'Database operation failed') {
    super(message, 500, true, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

class ExternalServiceError extends APIError {
  constructor(message = 'External service error') {
    super(message, 502, true, 'EXTERNAL_SERVICE_ERROR');
    this.name = 'ExternalServiceError';
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Enhanced global error handling middleware
 */
const globalErrorHandler = (error, req, res, next) => {
  let { statusCode = 500, message, errorCode } = error;

  // Log error details
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    statusCode,
    errorCode,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user?.id || null,
  };

  // Log based on severity
  if (statusCode >= 500) {
    console.error('Server Error:', errorInfo);
  } else if (statusCode >= 400) {
    console.warn('Client Error:', errorInfo);
  }

  // Handle specific error types
  if (error.code === '23505') {
    // Unique constraint violation
    statusCode = 409;
    message = 'Resource already exists';
    errorCode = 'DUPLICATE_RESOURCE';
  } else if (error.code === '23503') {
    // Foreign key constraint violation
    statusCode = 400;
    message = 'Invalid reference to related resource';
    errorCode = 'INVALID_REFERENCE';
  } else if (error.code === '23502') {
    // Not null violation
    statusCode = 400;
    message = 'Required field is missing';
    errorCode = 'MISSING_REQUIRED_FIELD';
  } else if (error.code === '23514') {
    // Check constraint violation
    statusCode = 400;
    message = 'Invalid data format';
    errorCode = 'INVALID_DATA_FORMAT';
  } else if (error.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
    errorCode = 'INVALID_TOKEN';
  } else if (error.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired';
    errorCode = 'TOKEN_EXPIRED';
  } else if (error.name === 'ValidationError' && error.details) {
    // Handle validation errors with details
    return res.status(400).json({
      error: 'Validation failed',
      message: error.message,
      errorCode: 'VALIDATION_ERROR',
      details: error.details,
      timestamp: new Date().toISOString(),
      requestId: req.id || null,
    });
  }

  // Prepare error response
  const errorResponse = {
    error: statusCode >= 500 ? 'Internal server error' : 'Request failed',
    message:
      process.env.NODE_ENV === 'development'
        ? message
        : statusCode >= 500
          ? 'Something went wrong'
          : message,
    errorCode: errorCode || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString(),
    requestId: req.id || null,
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.stack = error.stack;
  }

  // Add correlation ID if available
  if (req.correlationId) {
    errorResponse.correlationId = req.correlationId;
  }

  res.status(statusCode).json(errorResponse);
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  const error = {
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    errorCode: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    requestId: req.id || null,
  };

  res.status(404).json(error);
};

/**
 * Request ID middleware for error tracking
 */
const requestIdMiddleware = (req, res, next) => {
  req.id = generateRequestId();
  res.setHeader('X-Request-ID', req.id);
  next();
};

/**
 * Generate unique request ID
 */
const generateRequestId = () => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Error logger middleware
 */
const errorLogger = (error, req, res, next) => {
  // Log to external service in production
  if (process.env.NODE_ENV === 'production') {
    // TODO: Integrate with logging service (e.g., Sentry, LogRocket)
    console.error('Production Error:', {
      message: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      userId: req.user?.id,
      requestId: req.id,
    });
  }

  next(error);
};

module.exports = {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  DatabaseError,
  ExternalServiceError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
  requestIdMiddleware,
  errorLogger,
};
