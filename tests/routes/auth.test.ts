import request from 'supertest';
import express from 'express';
import { AuthError } from '../../src/types';
import { 
  mockUsers, 
  mockRegisterInputs, 
  mockLoginCredentials, 
  mockJWTPayloads,
  withoutPassword 
} from '../fixtures/users';
import { 
  createMockAuthService,
  resetAuthMocks,
  MockAuthService 
} from '../mocks/auth';

// Mock the AuthService module before importing routes
jest.mock('../../src/services/auth', () => {
  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    generateToken: jest.fn(),
    verifyToken: jest.fn(),
    decodeToken: jest.fn(),
    refreshToken: jest.fn(),
    revokeToken: jest.fn(),
    hashPassword: jest.fn(),
    comparePassword: jest.fn(),
    changePassword: jest.fn(),
    validatePassword: jest.fn(),
    getCurrentUser: jest.fn(),
    updateProfile: jest.fn(),
    deleteAccount: jest.fn(),
    isValidEmail: jest.fn(),
    getUserIdFromToken: jest.fn(),
    isTokenNearExpiry: jest.fn(),
    getTokenExpiration: jest.fn()
  };

  class MockAuthServiceClass {
    private static instance: MockAuthServiceClass;

    public static getInstance(): MockAuthServiceClass {
      if (!MockAuthServiceClass.instance) {
        MockAuthServiceClass.instance = new MockAuthServiceClass();
      }
      return MockAuthServiceClass.instance as any;
    }

    register = mockAuthService.register;
    login = mockAuthService.login;
    generateToken = mockAuthService.generateToken;
    verifyToken = mockAuthService.verifyToken;
    decodeToken = mockAuthService.decodeToken;
    refreshToken = mockAuthService.refreshToken;
    revokeToken = mockAuthService.revokeToken;
    hashPassword = mockAuthService.hashPassword;
    comparePassword = mockAuthService.comparePassword;
    changePassword = mockAuthService.changePassword;
    validatePassword = mockAuthService.validatePassword;
    getCurrentUser = mockAuthService.getCurrentUser;
    updateProfile = mockAuthService.updateProfile;
    deleteAccount = mockAuthService.deleteAccount;
    isValidEmail = mockAuthService.isValidEmail;
    getUserIdFromToken = mockAuthService.getUserIdFromToken;
    isTokenNearExpiry = mockAuthService.isTokenNearExpiry;
    getTokenExpiration = mockAuthService.getTokenExpiration;
  }

  // Store reference for test access
  (MockAuthServiceClass as any).__mockMethods = mockAuthService;

  return {
    __esModule: true,
    default: MockAuthServiceClass,
    AuthService: MockAuthServiceClass
  };
});

jest.mock('../../src/services/database');

// Import routes after mocking
import authRoutes from '../../src/routes/auth';

// Helper function to handle date serialization in API responses
const expectUserWithDates = (actual: any, expected: any) => {
  const { created_at, updated_at, ...rest } = expected;
  
  expect(actual).toMatchObject({
    ...rest,
    created_at: created_at instanceof Date ? created_at.toISOString() : created_at,
    updated_at: updated_at instanceof Date ? updated_at.toISOString() : updated_at
  });
};

describe('Auth Routes Integration', () => {
  let app: express.Application;
  let mockAuthService: any;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    resetAuthMocks();

    // Get the mocked methods from the AuthService mock
    const AuthServiceMock = require('../../src/services/auth').default;
    mockAuthService = (AuthServiceMock as any).__mockMethods;
    
    // Setup mock implementations
    const mockImplementations = createMockAuthService();
    Object.keys(mockImplementations).forEach(key => {
      if (mockAuthService[key] && typeof mockImplementations[key as keyof typeof mockImplementations] === 'function') {
        mockAuthService[key].mockImplementation(mockImplementations[key as keyof typeof mockImplementations]);
      }
    });

    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Error handler
    app.use((error: any, _req: any, res: any, _next: any) => {
      console.error('Test app error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR'
      });
    });
  });

  afterEach(() => {
    resetAuthMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser),
          token: MockAuthService.createMockToken(),
          expiresAt: new Date(Date.now() + 3600000)
        },
        message: 'User registered successfully'
      };

      mockAuthService.register.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRegisterInputs.valid)
        .expect(201);

      expect(response.body.success).toBe(true);
      expectUserWithDates(response.body.data.user, withoutPassword(mockUsers.validUser));
      expect(response.body.data.token).toBeDefined();
      expect(response.body.message).toBe('User registered successfully');
      expect(mockAuthService.register).toHaveBeenCalledWith(mockRegisterInputs.valid);
    });

    it('should reject registration with missing email', async () => {
      const invalidInput: any = { ...mockRegisterInputs.valid };
      delete invalidInput.email;

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: email');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should reject registration with missing password', async () => {
      const invalidInput: any = { ...mockRegisterInputs.valid };
      delete invalidInput.password;

      const response = await request(app)
        .post('/api/auth/register')
        .send(invalidInput)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: password');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
      expect(mockAuthService.register).not.toHaveBeenCalled();
    });

    it('should use default plan type when not provided', async () => {
      const inputWithoutPlan: any = { ...mockRegisterInputs.valid };
      delete inputWithoutPlan.planType;

      const mockResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser),
          token: MockAuthService.createMockToken(),
          expiresAt: new Date()
        },
        message: 'User registered successfully'
      };

      mockAuthService.register.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/auth/register')
        .send(inputWithoutPlan)
        .expect(201);

      expect(mockAuthService.register).toHaveBeenCalledWith({
        ...inputWithoutPlan,
        planType: 'free'
      });
      expect(response.body.success).toBe(true);
    });

    it('should handle invalid email error', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new AuthError('Invalid email format', 400, 'INVALID_EMAIL')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRegisterInputs.invalidEmail)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
      expect(response.body.code).toBe('INVALID_EMAIL');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle user already exists error', async () => {
      mockAuthService.register.mockRejectedValueOnce(
        new AuthError('User with this email already exists', 409, 'USER_EXISTS')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRegisterInputs.valid)
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('User with this email already exists');
      expect(response.body.code).toBe('USER_EXISTS');
    });

    it('should handle internal server error', async () => {
      mockAuthService.register.mockRejectedValueOnce(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRegisterInputs.valid)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should sanitize input to prevent XSS', async () => {
      const maliciousInput = {
        email: 'test<script>alert("xss")</script>@example.com',
        password: 'password<script>alert("xss")</script>123!'
      };

      const mockResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser),
          token: MockAuthService.createMockToken(),
          expiresAt: new Date()
        },
        message: 'User registered successfully'
      };

      mockAuthService.register.mockResolvedValueOnce(mockResponse);

      await request(app)
        .post('/api/auth/register')
        .send(maliciousInput)
        .expect(201);

      // Verify that the sanitized input was passed to the service
      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          password: 'password123!'
        })
      );
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser),
          token: MockAuthService.createMockToken(),
          expiresAt: new Date(Date.now() + 3600000)
        },
        message: 'Login successful'
      };

      mockAuthService.login.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/auth/login')
        .send(mockLoginCredentials.valid)
        .expect(200);

      expect(response.body.success).toBe(true);
      expectUserWithDates(response.body.data.user, withoutPassword(mockUsers.validUser));
      expect(response.body.data.token).toBeDefined();
      expect(response.body.message).toBe('Login successful');
      expect(mockAuthService.login).toHaveBeenCalledWith(mockLoginCredentials.valid);
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' }) // missing password
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: password');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should handle invalid credentials error', async () => {
      mockAuthService.login.mockRejectedValueOnce(
        new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS')
      );

      const response = await request(app)
        .post('/api/auth/login')
        .send(mockLoginCredentials.invalidPassword)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid credentials');
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should handle internal server error during login', async () => {
      mockAuthService.login.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/auth/login')
        .send(mockLoginCredentials.valid)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
      expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const oldToken = MockAuthService.createMockToken();
      const newToken = MockAuthService.createMockToken();
      const mockResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser),
          token: newToken,
          expiresAt: new Date(Date.now() + 3600000)
        },
        message: 'Token refreshed successfully'
      };

      mockAuthService.refreshToken.mockResolvedValueOnce(mockResponse);

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token: oldToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBe(newToken);
      expect(response.body.message).toBe('Token refreshed successfully');
      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(oldToken);
    });

    it('should reject refresh with missing token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: token');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should handle token not eligible for refresh', async () => {
      mockAuthService.refreshToken.mockRejectedValueOnce(
        new AuthError('Token does not need refresh yet', 400, 'TOKEN_NOT_ELIGIBLE_FOR_REFRESH')
      );

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ token: 'valid-but-not-near-expiry' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token does not need refresh yet');
      expect(response.body.code).toBe('TOKEN_NOT_ELIGIBLE_FOR_REFRESH');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user successfully', async () => {
      const validToken = MockAuthService.createMockToken();
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getCurrentUser.mockResolvedValueOnce(withoutPassword(mockUsers.validUser));
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expectUserWithDates(response.body.data, withoutPassword(mockUsers.validUser));
      expect(response.body.message).toBe('User information retrieved successfully');
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(validToken);
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header required');
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should reject request with invalid token', async () => {
      const invalidToken = MockAuthService.createInvalidToken();
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should reject request with expired token', async () => {
      const expiredToken = MockAuthService.createExpiredToken();
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Token has expired', 401, 'TOKEN_EXPIRED');
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Token has expired');
      expect(response.body.code).toBe('TOKEN_EXPIRED');
    });

    it('should set near expiry headers when token is near expiry', async () => {
      const nearExpiryToken = MockAuthService.createMockToken();
      const expirationDate = new Date(Date.now() + 3600000);
      
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getCurrentUser.mockResolvedValueOnce(withoutPassword(mockUsers.validUser));
      mockAuthService.isTokenNearExpiry.mockReturnValue(true);
      mockAuthService.getTokenExpiration.mockReturnValue(expirationDate);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${nearExpiryToken}`)
        .expect(200);

      expect(response.headers['x-token-near-expiry']).toBe('true');
      expect(response.headers['x-token-expires-at']).toBe(expirationDate.toISOString());
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should get user profile successfully', async () => {
      const validToken = MockAuthService.createMockToken();
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getCurrentUser.mockResolvedValueOnce(withoutPassword(mockUsers.validUser));
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user).toBeDefined();
      expectUserWithDates(response.body.data.user, withoutPassword(mockUsers.validUser));
      expect(response.body.message).toBe('User profile retrieved successfully');
      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(validToken);
    });

    it('should reject request without authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Authorization header required');
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });

    it('should reject request with invalid token', async () => {
      const invalidToken = MockAuthService.createInvalidToken();
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      });

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid token');
      expect(response.body.code).toBe('INVALID_TOKEN');
    });

    it('should handle service error gracefully', async () => {
      const validToken = MockAuthService.createMockToken();
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getCurrentUser.mockRejectedValueOnce(new Error('Database error'));
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Failed to fetch profile');
      expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should set near expiry headers when token is near expiry', async () => {
      const nearExpiryToken = MockAuthService.createMockToken();
      const expirationDate = new Date(Date.now() + 3600000);
      
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getCurrentUser.mockResolvedValueOnce(withoutPassword(mockUsers.validUser));
      mockAuthService.isTokenNearExpiry.mockReturnValue(true);
      mockAuthService.getTokenExpiration.mockReturnValue(expirationDate);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${nearExpiryToken}`)
        .expect(200);

      expect(response.headers['x-token-near-expiry']).toBe('true');
      expect(response.headers['x-token-expires-at']).toBe(expirationDate.toISOString());
    });
  });

  describe('PUT /api/auth/profile', () => {
    const validToken = MockAuthService.createMockToken();

    beforeEach(() => {
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);
    });

    it('should update user profile successfully', async () => {
      const updates = { email: 'newemail@example.com', plan_type: 'personal' };
      const updatedUser = { ...mockUsers.validUser, ...updates };
      
      mockAuthService.updateProfile.mockResolvedValueOnce(withoutPassword(updatedUser));

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(updates.email);
      expect(response.body.data.plan_type).toBe(updates.plan_type);
      expect(response.body.message).toBe('Profile updated successfully');
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(
        mockJWTPayloads.validUser.userId,
        updates
      );
    });

    it('should reject update with no fields provided', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('No fields to update');
      expect(response.body.code).toBe('NO_UPDATES_PROVIDED');
      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
    });

    it('should handle invalid email error', async () => {
      mockAuthService.updateProfile.mockRejectedValueOnce(
        new AuthError('Invalid email format', 400, 'INVALID_EMAIL')
      );

      const response = await request(app)
        .put('/api/auth/profile')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ email: 'invalid-email' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid email format');
      expect(response.body.code).toBe('INVALID_EMAIL');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/auth/profile')
        .send({ email: 'test@example.com' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('PUT /api/auth/password', () => {
    const validToken = MockAuthService.createMockToken();

    beforeEach(() => {
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);
    });

    it('should change password successfully', async () => {
      const passwordRequest = {
        oldPassword: 'oldpassword123',
        newPassword: 'NewPassword123!'
      };

      mockAuthService.changePassword.mockResolvedValueOnce({
        success: true,
        message: 'Password changed successfully'
      });

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send(passwordRequest)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password changed successfully. Please log in again.');
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        mockJWTPayloads.validUser.userId,
        passwordRequest
      );
      expect(mockAuthService.revokeToken).toHaveBeenCalledWith(validToken);
    });

    it('should reject change with missing fields', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ oldPassword: 'old123' }) // missing newPassword
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: newPassword');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should handle incorrect old password', async () => {
      mockAuthService.changePassword.mockRejectedValueOnce(
        new AuthError('Current password is incorrect', 401, 'INVALID_OLD_PASSWORD')
      );

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          oldPassword: 'wrongpassword',
          newPassword: 'NewPassword123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Current password is incorrect');
      expect(response.body.code).toBe('INVALID_OLD_PASSWORD');
    });

    it('should handle weak new password', async () => {
      mockAuthService.changePassword.mockRejectedValueOnce(
        new AuthError('New password validation failed', 400, 'INVALID_NEW_PASSWORD')
      );

      const response = await request(app)
        .put('/api/auth/password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          oldPassword: 'oldpassword123',
          newPassword: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('New password validation failed');
      expect(response.body.code).toBe('INVALID_NEW_PASSWORD');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .put('/api/auth/password')
        .send({
          oldPassword: 'old123',
          newPassword: 'New123!'
        })
        .expect(401);

      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout user successfully', async () => {
      const validToken = MockAuthService.createMockToken();
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Logout successful');
      expect(mockAuthService.revokeToken).toHaveBeenCalledWith(validToken);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('DELETE /api/auth/account', () => {
    const validToken = MockAuthService.createMockToken();

    beforeEach(() => {
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);
    });

    it('should delete account successfully', async () => {
      mockAuthService.deleteAccount.mockResolvedValueOnce({
        success: true,
        message: 'Account deleted successfully'
      });

      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ password: 'correctpassword' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Account deleted successfully');
      expect(mockAuthService.deleteAccount).toHaveBeenCalledWith(
        mockJWTPayloads.validUser.userId,
        'correctpassword'
      );
      expect(mockAuthService.revokeToken).toHaveBeenCalledWith(validToken);
    });

    it('should reject deletion with missing password', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${validToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: password');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });

    it('should handle incorrect password', async () => {
      mockAuthService.deleteAccount.mockRejectedValueOnce(
        new AuthError('Password is incorrect', 401, 'INVALID_PASSWORD')
      );

      const response = await request(app)
        .delete('/api/auth/account')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ password: 'wrongpassword' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Password is incorrect');
      expect(response.body.code).toBe('INVALID_PASSWORD');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/auth/account')
        .send({ password: 'password123' })
        .expect(401);

      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('POST /api/auth/validate-password', () => {
    it('should validate strong password successfully', async () => {
      mockAuthService.validatePassword.mockReturnValue({
        isValid: true,
        errors: [],
        strength: 'strong'
      });

      const response = await request(app)
        .post('/api/auth/validate-password')
        .send({ password: 'StrongPassword123!' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data.strength).toBe('strong');
      expect(response.body.message).toBe('Password validation complete');
    });

    it('should validate weak password and return errors', async () => {
      mockAuthService.validatePassword.mockReturnValue({
        isValid: false,
        errors: ['Password must be at least 8 characters long'],
        strength: 'weak'
      });

      const response = await request(app)
        .post('/api/auth/validate-password')
        .send({ password: '123' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(false);
      expect(response.body.data.errors).toContain('Password must be at least 8 characters long');
      expect(response.body.data.strength).toBe('weak');
    });

    it('should reject request with missing password', async () => {
      const response = await request(app)
        .post('/api/auth/validate-password')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Missing required fields: password');
      expect(response.body.code).toBe('MISSING_REQUIRED_FIELDS');
    });
  });

  describe('GET /api/auth/token-info', () => {
    it('should get token information successfully', async () => {
      const validToken = MockAuthService.createMockToken();
      const expirationDate = new Date(Date.now() + 3600000);
      
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getTokenExpiration.mockReturnValue(expirationDate);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      const response = await request(app)
        .get('/api/auth/token-info')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.expiresAt).toBe(expirationDate.toISOString());
      expect(response.body.data.isNearExpiry).toBe(false);
      expect(response.body.data.user).toEqual(mockJWTPayloads.validUser);
      expect(response.body.message).toBe('Token information retrieved successfully');
    });

    it('should indicate when token is near expiry', async () => {
      const nearExpiryToken = MockAuthService.createMockToken();
      const expirationDate = new Date(Date.now() + 1800000); // 30 minutes
      
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.getTokenExpiration.mockReturnValue(expirationDate);
      mockAuthService.isTokenNearExpiry.mockReturnValue(true);

      const response = await request(app)
        .get('/api/auth/token-info')
        .set('Authorization', `Bearer ${nearExpiryToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isNearExpiry).toBe(true);
      expect(response.headers['x-token-near-expiry']).toBe('true');
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/token-info')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_AUTH_HEADER');
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parsing errors gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String),
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/)
      });
    });

    it('should handle Content-Type validation', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'text/plain')
        .send('email=test@example.com&password=password123')
        .expect(400);

      // Should fail validation due to missing required fields
      expect(response.body.success).toBe(false);
    });
  });

  describe('Security Headers', () => {
    it('should include timestamp in error responses', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com' }) // missing password
        .expect(400);

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should not expose internal error details', async () => {
      mockAuthService.register.mockRejectedValueOnce(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/register')
        .send(mockRegisterInputs.valid)
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.error).not.toContain('Database connection failed');
    });
  });
});