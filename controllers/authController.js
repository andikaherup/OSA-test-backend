const User = require('../models/User');
const { hashPassword, comparePassword, validatePassword } = require('../utils/password');
const { generateToken } = require('../utils/jwt');
const { 
  ValidationError, 
  ConflictError, 
  AuthenticationError,
  DatabaseError,
  asyncHandler 
} = require('../middleware/errorHandler');

/**
 * Register a new user
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, first_name, last_name } = req.body;

  // Validate required fields
  const missingFields = [];
  if (!email) missingFields.push('email');
  if (!password) missingFields.push('password');
  if (!first_name) missingFields.push('first_name');
  if (!last_name) missingFields.push('last_name');

  if (missingFields.length > 0) {
    throw new ValidationError(
      'Missing required fields',
      missingFields.map(field => ({ field, message: `${field} is required` }))
    );
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError(
      'Invalid email format',
      [{ field: 'email', message: 'Please provide a valid email address' }]
    );
  }

  // Validate password strength
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    throw new ValidationError(
      'Password does not meet requirements',
      passwordValidation.errors.map(error => ({ field: 'password', message: error }))
    );
  }

  // Validate name fields
  if (first_name.trim().length < 1 || first_name.trim().length > 50) {
    throw new ValidationError(
      'Invalid first name',
      [{ field: 'first_name', message: 'First name must be between 1 and 50 characters' }]
    );
  }

  if (last_name.trim().length < 1 || last_name.trim().length > 50) {
    throw new ValidationError(
      'Invalid last name',
      [{ field: 'last_name', message: 'Last name must be between 1 and 50 characters' }]
    );
  }

  try {
    // Check if user already exists
    const existingUser = await User.findByEmail(email.toLowerCase());
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash,
      first_name: first_name.trim(),
      last_name: last_name.trim(),
    });

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof ConflictError) {
      throw error;
    }
    throw new DatabaseError('Failed to register user');
  }
});

/**
 * Login user
 */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    throw new ValidationError(
      'Missing required fields',
      [
        { field: 'email', message: 'Email is required' },
        { field: 'password', message: 'Password is required' }
      ].filter(item => 
        (item.field === 'email' && !email) || 
        (item.field === 'password' && !password)
      )
    );
  }

  try {
    // Find user by email
    const user = await User.findByEmail(email.toLowerCase());
    if (!user) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Verify password
    const isValidPassword = await comparePassword(password, user.password_hash);
    if (!isValidPassword) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new DatabaseError('Failed to login');
  }
});

/**
 * Get current user profile
 */
const getProfile = async (req, res) => {
  try {
    // User is already attached to req by auth middleware
    res.json({
      user: req.user.toJSON(),
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get user profile',
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name } = req.body;
    const updateData = {};

    if (first_name !== undefined) {
      updateData.first_name = first_name.trim();
    }

    if (last_name !== undefined) {
      updateData.last_name = last_name.trim();
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'No valid fields to update',
      });
    }

    const updatedUser = await req.user.update(updateData);

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser.toJSON(),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update profile',
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile,
};