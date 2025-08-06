import { NextFunction } from 'express';
import { AuthMiddleware } from '../../src/middleware/auth';
import { AuthError } from '../../src/types';
import { mockJWTPayloads } from '../fixtures/users';
import { 
  mockAuthServiceInstance, 
  resetAuthMocks,
  createMockRequest, 
  createMockResponse, 
  createMockNext 
} from '../mocks/auth';

// Mock the AuthService
jest.mock('../../src/services/auth');

describe('AuthMiddleware', () => {
  let mockAuthService: any;
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    resetAuthMocks();
    
    // Setup auth service mock
    mockAuthService = mockAuthServiceInstance();
    
    // Create fresh mock objects for each test
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  afterEach(() => {
    resetAuthMocks();
  });

  describe('authenticateToken', () => {
    it('should authenticate valid token successfully', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(false);

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockReq.user).toEqual(mockJWTPayloads.validUser);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should set near expiry headers when token is near expiry', async () => {
      const expirationDate = new Date(Date.now() + 3600000); // 1 hour from now
      mockReq.headers.authorization = 'Bearer near-expiry-token';
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);
      mockAuthService.isTokenNearExpiry.mockReturnValue(true);
      mockAuthService.getTokenExpiration.mockReturnValue(expirationDate);

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Token-Near-Expiry', 'true');
      expect(mockRes.setHeader).toHaveBeenCalledWith('X-Token-Expires-At', expirationDate.toISOString());
      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject request with missing authorization header', async () => {
      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authorization header required',
        code: 'MISSING_AUTH_HEADER'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization header format', async () => {
      mockReq.headers.authorization = 'InvalidFormat token';

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid authorization header format. Use: Bearer <token>',
        code: 'INVALID_AUTH_FORMAT'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject request with missing token', async () => {
      mockReq.headers.authorization = 'Bearer ';

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access token required',
        code: 'MISSING_TOKEN'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject expired token', async () => {
      mockReq.headers.authorization = 'Bearer expired-token';
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Token has expired', 401, 'TOKEN_EXPIRED');
      });

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject revoked token', async () => {
      mockReq.headers.authorization = 'Bearer revoked-token';
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
      });

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle generic authentication errors', async () => {
      mockReq.headers.authorization = 'Bearer problematic-token';
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await AuthMiddleware.authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizePlan', () => {
    beforeEach(() => {
      mockReq.user = mockJWTPayloads.validUser; // free plan
    });

    it('should allow access for matching plan', () => {
      const middleware = AuthMiddleware.authorizePlan(['free', 'personal']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access for higher tier plan', () => {
      mockReq.user.planType = 'team';
      const middleware = AuthMiddleware.authorizePlan(['free', 'personal']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject access for insufficient plan', () => {
      const middleware = AuthMiddleware.authorizePlan(['personal', 'team']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient plan privileges',
        code: 'INSUFFICIENT_PLAN',
        data: {
          requiredPlans: ['personal', 'team'],
          currentPlan: 'free'
        }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      delete mockReq.user;
      const middleware = AuthMiddleware.authorizePlan(['free']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('authorizeUser', () => {
    beforeEach(() => {
      mockReq.user = mockJWTPayloads.validUser;
    });

    it('should allow access when user accesses own resource by userId param', () => {
      mockReq.params.userId = mockJWTPayloads.validUser.userId;

      AuthMiddleware.authorizeUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should allow access when user accesses own resource by id param', () => {
      mockReq.params.id = mockJWTPayloads.validUser.userId;

      AuthMiddleware.authorizeUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow access when no resource ID in params', () => {
      // No userId or id in params - general access
      AuthMiddleware.authorizeUser(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject access when user tries to access other user resource', () => {
      mockReq.params.userId = 'different-user-id';

      AuthMiddleware.authorizeUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Access denied. You can only access your own resources.',
        code: 'ACCESS_DENIED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated requests', () => {
      delete mockReq.user;

      AuthMiddleware.authorizeUser(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('should set user when valid token is provided', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      mockAuthService.verifyToken.mockReturnValue(mockJWTPayloads.validUser);

      await AuthMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockAuthService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(mockReq.user).toEqual(mockJWTPayloads.validUser);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user when no authorization header', async () => {
      await AuthMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user when invalid header format', async () => {
      mockReq.headers.authorization = 'InvalidFormat';

      await AuthMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockAuthService.verifyToken).not.toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue without user when token verification fails', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      });

      await AuthMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('should continue when any error occurs', async () => {
      mockReq.headers.authorization = 'Bearer problematic-token';
      mockAuthService.verifyToken.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await AuthMiddleware.optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('validateRequiredFields', () => {
    it('should pass when all required fields are present', () => {
      mockReq.body = {
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      };
      const middleware = AuthMiddleware.validateRequiredFields(['email', 'password']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject when required fields are missing', () => {
      mockReq.body = {
        email: 'test@example.com'
        // password is missing
      };
      const middleware = AuthMiddleware.validateRequiredFields(['email', 'password']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: password',
        code: 'MISSING_REQUIRED_FIELDS',
        data: { missingFields: ['password'] }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when multiple required fields are missing', () => {
      mockReq.body = {};
      const middleware = AuthMiddleware.validateRequiredFields(['email', 'password', 'name']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Missing required fields: email, password, name',
        code: 'MISSING_REQUIRED_FIELDS',
        data: { missingFields: ['email', 'password', 'name'] }
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject when fields are empty strings', () => {
      mockReq.body = {
        email: '',
        password: '   '
      };
      const middleware = AuthMiddleware.validateRequiredFields(['email', 'password']);

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Missing required fields'),
          code: 'MISSING_REQUIRED_FIELDS'
        })
      );
    });
  });

  describe('sanitizeInput', () => {
    it('should remove script tags from string inputs', () => {
      mockReq.body = {
        message: 'Hello <script>alert("xss")</script> World',
        title: 'Normal title'
      };

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.message).toBe('Hello  World');
      expect(mockReq.body.title).toBe('Normal title');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should remove javascript: protocols', () => {
      mockReq.body = {
        link: 'javascript:alert("xss")',
        normalLink: 'https://example.com'
      };

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.link).toBe('');
      expect(mockReq.body.normalLink).toBe('https://example.com');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should remove event handlers', () => {
      mockReq.body = {
        html: '<div onclick="malicious()">Content</div>',
        text: 'Normal text'
      };

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.html).toBe('<div>Content</div>');
      expect(mockReq.body.text).toBe('Normal text');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should trim whitespace', () => {
      mockReq.body = {
        trimMe: '  spaces around  ',
        normal: 'no spaces'
      };

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body.trimMe).toBe('spaces around');
      expect(mockReq.body.normal).toBe('no spaces');
      expect(mockNext).toHaveBeenCalled();
    });

    it('should not modify non-string values', () => {
      mockReq.body = {
        number: 123,
        boolean: true,
        object: { nested: 'value' },
        array: [1, 2, 3]
      };

      const originalBody = JSON.parse(JSON.stringify(mockReq.body));

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockReq.body).toEqual(originalBody);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle empty body', () => {
      delete mockReq.body;

      AuthMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Utility Methods', () => {
    describe('getUserId', () => {
      it('should return user ID from authenticated request', () => {
        mockReq.user = mockJWTPayloads.validUser;

        const userId = AuthMiddleware.getUserId(mockReq);

        expect(userId).toBe(mockJWTPayloads.validUser.userId);
      });

      it('should throw error when user not authenticated', () => {
        delete mockReq.user;

        expect(() => AuthMiddleware.getUserId(mockReq))
          .toThrow(new AuthError('User not authenticated', 401, 'NOT_AUTHENTICATED'));
      });
    });

    describe('getUserEmail', () => {
      it('should return user email from authenticated request', () => {
        mockReq.user = mockJWTPayloads.validUser;

        const email = AuthMiddleware.getUserEmail(mockReq);

        expect(email).toBe(mockJWTPayloads.validUser.email);
      });

      it('should throw error when user not authenticated', () => {
        delete mockReq.user;

        expect(() => AuthMiddleware.getUserEmail(mockReq))
          .toThrow(new AuthError('User not authenticated', 401, 'NOT_AUTHENTICATED'));
      });
    });

    describe('hasMinimumPlan', () => {
      it('should return true for exact plan match', () => {
        mockReq.user = { ...mockJWTPayloads.validUser, planType: 'personal' };

        const result = AuthMiddleware.hasMinimumPlan(mockReq, 'personal');

        expect(result).toBe(true);
      });

      it('should return true for higher plan', () => {
        mockReq.user = { ...mockJWTPayloads.validUser, planType: 'team' };

        const result = AuthMiddleware.hasMinimumPlan(mockReq, 'free');

        expect(result).toBe(true);
      });

      it('should return false for lower plan', () => {
        mockReq.user = { ...mockJWTPayloads.validUser, planType: 'free' };

        const result = AuthMiddleware.hasMinimumPlan(mockReq, 'personal');

        expect(result).toBe(false);
      });

      it('should return false when not authenticated', () => {
        delete mockReq.user;

        const result = AuthMiddleware.hasMinimumPlan(mockReq, 'free');

        expect(result).toBe(false);
      });

      it('should handle unknown plan types', () => {
        mockReq.user = { ...mockJWTPayloads.validUser, planType: 'unknown' };

        const result = AuthMiddleware.hasMinimumPlan(mockReq, 'free');

        expect(result).toBe(false);
      });
    });
  });

  describe('Rate Limiting Middleware', () => {
    // Note: These are more like integration tests since we're testing the configuration
    // rather than the middleware behavior itself (which is handled by express-rate-limit)

    it('should have proper configuration for login rate limit', () => {
      expect(AuthMiddleware.loginRateLimit).toBeDefined();
      expect(typeof AuthMiddleware.loginRateLimit).toBe('function');
    });

    it('should have proper configuration for register rate limit', () => {
      expect(AuthMiddleware.registerRateLimit).toBeDefined();
      expect(typeof AuthMiddleware.registerRateLimit).toBe('function');
    });

    it('should have proper configuration for API rate limit', () => {
      expect(AuthMiddleware.apiRateLimit).toBeDefined();
      expect(typeof AuthMiddleware.apiRateLimit).toBe('function');
    });

    it('should have proper configuration for password change rate limit', () => {
      expect(AuthMiddleware.passwordChangeRateLimit).toBeDefined();
      expect(typeof AuthMiddleware.passwordChangeRateLimit).toBe('function');
    });

    it('should have proper configuration for account deletion rate limit', () => {
      expect(AuthMiddleware.accountDeletionRateLimit).toBeDefined();
      expect(typeof AuthMiddleware.accountDeletionRateLimit).toBe('function');
    });
  });
});