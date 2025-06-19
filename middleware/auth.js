const { verifyToken, extractTokenFromHeader } = require('../utils/jwt');
const User = require('../models/User');

/**
 * Middleware to authenticate JWT token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'No token provided',
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'Invalid token - user not found',
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: 'Access denied',
      message: error.message,
    });
  }
};

/**
 * Optional authentication middleware
 * Adds user to request if token is valid, but doesn't block if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId);
      
      if (user) {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Silent fail for optional auth
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
};