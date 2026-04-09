// backend/middleware/errorHandler.js

/**
 * Standardized Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error(`❌ [Error Handled]: ${err.message}`);
  if (err.stack) {
    // Log stack trace only in development
    if (process.env.NODE_ENV !== 'production') {
      console.error(err.stack);
    }
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    error: message,
    code: err.code || 'INTERNAL_ERROR',
    timestamp: new Date().toISOString()
  });
};

/**
 * Custom Error Class for API Errors
 */
/**
 * middleware/errorHandler.js
 * 
 * Centralized error management middleware.
 * Standardizes API error responses and status codes across all modular routes.
 */
class APIError extends Error {
  constructor(message, statusCode = 500, code = 'API_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = {
  errorHandler,
  APIError
};
