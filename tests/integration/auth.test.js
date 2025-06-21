const request = require('supertest');
const express = require('express');
const authRoutes = require('../../routes/auth');
const { globalErrorHandler } = require('../../middleware/errorHandler');
const TestDatabase = require('../helpers/database');

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(globalErrorHandler);
  return app;
};

describe('Authentication API', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(async () => {
    await TestDatabase.cleanup();
  });

  afterAll(async () => {
    await TestDatabase.cleanup();
  });

  describe('POST /api/auth/register', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      first_name: 'John',
      last_name: 'Doe',
    };

    test('should register a new user successfully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      expect(response.body).toHaveProperty(
        'message',
        'User registered successfully'
      );
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(validUserData.email);
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    test('should return error for missing required fields', async () => {
      const incompleteData = {
        email: 'test@example.com',
        password: 'TestPassword123!',
        // missing first_name and last_name
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(incompleteData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });

    test('should return error for invalid email format', async () => {
      const invalidEmailData = {
        ...validUserData,
        email: 'invalid-email',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidEmailData)
        .expect(400);

      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });

    test('should return error for weak password', async () => {
      const weakPasswordData = {
        ...validUserData,
        password: '123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(weakPasswordData)
        .expect(400);

      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });

    test('should return error for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(201);

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send(validUserData)
        .expect(409);

      expect(response.body).toHaveProperty('errorCode', 'CONFLICT_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    const userData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      first_name: 'John',
      last_name: 'Doe',
    };

    beforeEach(async () => {
      // Register a user for login tests
      await request(app).post('/api/auth/register').send(userData);
    });

    test('should login with valid credentials', async () => {
      const loginData = {
        email: userData.email,
        password: userData.password,
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user.email).toBe(userData.email);
    });

    test('should return error for invalid email', async () => {
      const invalidLoginData = {
        email: 'nonexistent@example.com',
        password: userData.password,
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLoginData)
        .expect(401);

      expect(response.body).toHaveProperty('errorCode', 'AUTHENTICATION_ERROR');
    });

    test('should return error for invalid password', async () => {
      const invalidLoginData = {
        email: userData.email,
        password: 'WrongPassword123!',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(invalidLoginData)
        .expect(401);

      expect(response.body).toHaveProperty('errorCode', 'AUTHENTICATION_ERROR');
    });

    test('should return error for missing credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });
  });

  describe('GET /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      // Register and login to get token
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          first_name: 'John',
          last_name: 'Doe',
        });

      authToken = registerResponse.body.token;
    });

    test('should get user profile with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    test('should return error without token', async () => {
      const response = await request(app).get('/api/auth/profile').expect(401);

      expect(response.body).toHaveProperty('errorCode', 'AUTHENTICATION_ERROR');
    });

    test('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('errorCode', 'AUTHENTICATION_ERROR');
    });
  });

  describe('PUT /api/auth/profile', () => {
    let authToken;

    beforeEach(async () => {
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!',
          first_name: 'John',
          last_name: 'Doe',
        });

      authToken = registerResponse.body.token;
    });

    test('should update user profile', async () => {
      const updateData = {
        first_name: 'Jane',
        last_name: 'Smith',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body).toHaveProperty(
        'message',
        'Profile updated successfully'
      );
      expect(response.body.user.first_name).toBe('Jane');
      expect(response.body.user.last_name).toBe('Smith');
    });

    test('should sanitize input data', async () => {
      const updateData = {
        first_name: '  Jane  <script>alert("xss")</script>  ',
        last_name: 'Smith',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.user.first_name).toBe('Jane alert("xss")');
    });

    test('should return error for invalid name length', async () => {
      const updateData = {
        first_name: 'a'.repeat(51), // Too long
        last_name: 'Smith',
      };

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body).toHaveProperty('errorCode', 'VALIDATION_ERROR');
    });
  });
});
