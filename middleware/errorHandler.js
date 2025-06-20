/**
 * Custom error class for API errors
 */
class APIError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'APIError';

    Error.captureStackTrace(this, this.constructor);
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
 * Global error handling middleware
 */
const globalErrorHandler = (error, req, res, next) => {
  let { statusCode = 500, message } = error;

  // Handle specific error types
  if (error.code === '23505') {
    // Unique constraint violation
    statusCode = 409;
    message = 'Resource already exists';
  } else if (error.code === '23503') {
    // Foreign key constraint violation
    statusCode = 400;
    message = 'Invalid reference to related resource';
  } else if (error.code === '23502') {
    // Not null violation
    statusCode = 400;
    message = 'Required field is missing';
  }

  // Log error details in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      statusCode,
      url: req.url,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal server error' : 'Request failed',
    message:
      process.env.NODE_ENV === 'development'
        ? message
        : statusCode >= 500
          ? 'Something went wrong'
          : message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
};

/**
 * 404 handler for undefined routes
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = {
  APIError,
  asyncHandler,
  globalErrorHandler,
  notFoundHandler,
};
