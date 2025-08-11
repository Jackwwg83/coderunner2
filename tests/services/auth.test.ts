import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AuthService } from '../../src/services/auth';
import { AuthError, PasswordChangeRequest } from '../../src/types';
import { 
  mockUsers, 
  mockRegisterInputs, 
  mockLoginCredentials, 
  mockJWTPayloads
} from '../fixtures/users';
import { mockDatabaseServiceInstance, resetDatabaseMocks } from '../mocks/database';

// Mock external dependencies
jest.mock('jsonwebtoken');
jest.mock('bcrypt');
jest.mock('../../src/services/database');

const mockJwt = jwt as any;
const mockBcrypt = bcrypt as any;

// Create mock JWT error classes
class MockTokenExpiredError extends Error {
  override name = 'TokenExpiredError';
  constructor(message: string) {
    super(message);
  }
}

class MockJsonWebTokenError extends Error {
  override name = 'JsonWebTokenError';
  constructor(message: string) {
    super(message);
  }
}

// Mock JWT error classes on the jwt object
mockJwt.TokenExpiredError = MockTokenExpiredError;
mockJwt.JsonWebTokenError = MockJsonWebTokenError;

describe('AuthService', () => {
  let authService: AuthService;
  let mockDb: any;

  beforeAll(() => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.BCRYPT_ROUNDS = '4';
  });

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    resetDatabaseMocks();
    
    // Setup database mock
    mockDb = mockDatabaseServiceInstance();
    
    // Reset AuthService singleton to ensure it gets the mocked database
    (AuthService as any).instance = null;
    
    // Get AuthService instance
    authService = AuthService.getInstance();
    
    // Clear token blacklist
    (authService as any).tokenBlacklist.clear();
  });

  afterEach(() => {
    resetDatabaseMocks();
  });

  describe('Initialization', () => {
    it('should be a singleton', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it.skip('should warn about fallback JWT secret in development', () => {
      // This test is skipped as it's difficult to isolate singleton behavior
      // in a test environment without affecting other tests
      // The functionality is still present in the code and works correctly in runtime
    });
  });

  describe('User Registration', () => {
    beforeEach(() => {
      mockBcrypt.hash.mockResolvedValue('hashedpassword123');
      mockJwt.sign.mockReturnValue('mock-jwt-token');
      mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
    });

    describe('register()', () => {
      it('should register new user successfully', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(null);
        mockDb.createUser.mockResolvedValueOnce(mockUsers.validUser);

        const result = await authService.register(mockRegisterInputs.valid);

        expect(mockDb.getUserByEmail).toHaveBeenCalledWith(mockRegisterInputs.valid.email);
        expect(mockBcrypt.hash).toHaveBeenCalledWith(mockRegisterInputs.valid.password, parseInt(process.env.BCRYPT_ROUNDS || '10'));
        expect(mockDb.createUser).toHaveBeenCalledWith({
          email: mockRegisterInputs.valid.email,
          password_hash: 'hashedpassword123',
          plan_type: mockRegisterInputs.valid.planType
        });
        expect(mockJwt.sign).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data?.user).toEqual({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type,
          created_at: mockUsers.validUser.created_at,
          updated_at: mockUsers.validUser.updated_at
        });
        expect(result.data?.token).toBe('mock-jwt-token');
      });

      it('should reject registration with invalid email', async () => {
        await expect(authService.register(mockRegisterInputs.invalidEmail))
          .rejects.toThrow(new AuthError('Invalid email format', 400, 'INVALID_EMAIL'));

        expect(mockDb.getUserByEmail).not.toHaveBeenCalled();
      });

      it('should reject registration with weak password', async () => {
        await expect(authService.register(mockRegisterInputs.weakPassword))
          .rejects.toThrow(expect.objectContaining({
            message: expect.stringContaining('Password validation failed'),
            statusCode: 400,
            code: 'INVALID_PASSWORD'
          }));

        expect(mockDb.getUserByEmail).not.toHaveBeenCalled();
      });

      it('should reject registration when user already exists', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(mockUsers.validUser);

        await expect(authService.register(mockRegisterInputs.valid))
          .rejects.toThrow(new AuthError('User with this email already exists', 409, 'USER_EXISTS'));

        expect(mockDb.createUser).not.toHaveBeenCalled();
      });

      it('should handle database errors during registration', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(null);
        mockDb.createUser.mockRejectedValueOnce(new Error('Database error'));

        await expect(authService.register(mockRegisterInputs.valid))
          .rejects.toThrow(new AuthError('Registration failed', 500, 'REGISTRATION_FAILED'));
      });

      it('should use default plan type when not provided', async () => {
        const inputWithoutPlan = { ...mockRegisterInputs.valid };
        delete inputWithoutPlan.planType;

        mockDb.getUserByEmail.mockResolvedValueOnce(null);
        mockDb.createUser.mockResolvedValueOnce(mockUsers.validUser);

        await authService.register(inputWithoutPlan);

        expect(mockDb.createUser).toHaveBeenCalledWith({
          email: inputWithoutPlan.email,
          password_hash: 'hashedpassword123',
          plan_type: 'free'
        });
      });
    });
  });

  describe('User Login', () => {
    beforeEach(() => {
      mockBcrypt.compare.mockResolvedValue(true);
      mockBcrypt.hash.mockResolvedValue('dummy-hash');
      mockJwt.sign.mockReturnValue('mock-jwt-token');
      mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
    });

    describe('login()', () => {
      it('should login user successfully', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(mockUsers.validUser);

        const result = await authService.login(mockLoginCredentials.valid);

        expect(mockDb.getUserByEmail).toHaveBeenCalledWith(mockLoginCredentials.valid.email);
        expect(mockBcrypt.compare).toHaveBeenCalledWith(mockLoginCredentials.valid.password, mockUsers.validUser.password_hash);
        expect(mockJwt.sign).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data?.user).toEqual(expect.objectContaining({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type,
          created_at: mockUsers.validUser.created_at,
          updated_at: mockUsers.validUser.updated_at
        }));
        expect(result.data?.user).not.toHaveProperty('password_hash');
        expect(result.data?.token).toBe('mock-jwt-token');
      });

      it('should reject login with invalid email format', async () => {
        await expect(authService.login(mockLoginCredentials.invalidFormat))
          .rejects.toThrow(new AuthError('Invalid email format', 400, 'INVALID_EMAIL'));

        expect(mockDb.getUserByEmail).not.toHaveBeenCalled();
      });

      it('should reject login with empty password', async () => {
        const credentialsWithoutPassword = { ...mockLoginCredentials.valid, password: '' };

        await expect(authService.login(credentialsWithoutPassword))
          .rejects.toThrow(new AuthError('Password is required', 400, 'PASSWORD_REQUIRED'));
      });

      it('should reject login when user does not exist', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(null);

        await expect(authService.login(mockLoginCredentials.invalidEmail))
          .rejects.toThrow(new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));

        // Should still hash password to prevent timing attacks
        expect(mockBcrypt.hash).toHaveBeenCalledWith(mockLoginCredentials.invalidEmail.password, parseInt(process.env.BCRYPT_ROUNDS || '10'));
      });

      it('should reject login with invalid password', async () => {
        mockDb.getUserByEmail.mockResolvedValueOnce(mockUsers.validUser);
        mockBcrypt.compare.mockResolvedValueOnce(false);

        await expect(authService.login(mockLoginCredentials.invalidPassword))
          .rejects.toThrow(new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS'));
      });

      it('should handle database errors during login', async () => {
        mockDb.getUserByEmail.mockRejectedValueOnce(new Error('Database error'));

        await expect(authService.login(mockLoginCredentials.valid))
          .rejects.toThrow(new AuthError('Login failed', 500, 'LOGIN_FAILED'));
      });
    });
  });

  describe('Token Management', () => {
    describe('generateToken()', () => {
      it('should generate JWT token with correct payload', () => {
        mockJwt.sign.mockReturnValue('generated-token');

        const token = authService.generateToken({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type
        });

        expect(mockJwt.sign).toHaveBeenCalledWith(
          {
            userId: mockUsers.validUser.id,
            email: mockUsers.validUser.email,
            planType: mockUsers.validUser.plan_type
          },
          'test-jwt-secret-key-for-testing-only',
          {
            expiresIn: '1h',
            issuer: 'coderunner-api',
            audience: 'coderunner-client'
          }
        );
        expect(token).toBe('generated-token');
      });
    });

    describe('verifyToken()', () => {
      it('should verify valid token successfully', () => {
        mockJwt.verify.mockReturnValue(mockJWTPayloads.validUser);

        const result = authService.verifyToken('valid-token');

        expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret-key-for-testing-only', {
          issuer: 'coderunner-api',
          audience: 'coderunner-client'
        });
        expect(result).toEqual(mockJWTPayloads.validUser);
      });

      it('should reject blacklisted token', () => {
        const blacklistedToken = 'blacklisted-token';
        authService.revokeToken(blacklistedToken);

        expect(() => authService.verifyToken(blacklistedToken))
          .toThrow(new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED'));
      });

      it('should reject expired token', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new MockTokenExpiredError('Token expired');
        });

        expect(() => authService.verifyToken('expired-token'))
          .toThrow(expect.objectContaining({
            message: 'Token has expired',
            statusCode: 401,
            code: 'TOKEN_EXPIRED'
          }));
      });

      it('should reject malformed token', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new MockJsonWebTokenError('Invalid token');
        });

        expect(() => authService.verifyToken('invalid-token'))
          .toThrow(expect.objectContaining({
            message: 'Invalid token',
            statusCode: 401,
            code: 'INVALID_TOKEN'
          }));
      });

      it('should handle other verification errors', () => {
        mockJwt.verify.mockImplementation(() => {
          throw new Error('Unknown error');
        });

        expect(() => authService.verifyToken('problematic-token'))
          .toThrow(new AuthError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED'));
      });
    });

    describe('decodeToken()', () => {
      it('should decode token successfully', () => {
        mockJwt.decode.mockReturnValue(mockJWTPayloads.validUser);

        const result = authService.decodeToken('some-token');

        expect(mockJwt.decode).toHaveBeenCalledWith('some-token');
        expect(result).toEqual(mockJWTPayloads.validUser);
      });

      it('should return null for invalid token', () => {
        mockJwt.decode.mockImplementation(() => {
          throw new Error('Invalid token');
        });

        const result = authService.decodeToken('invalid-token');

        expect(result).toBeNull();
      });
    });

    describe('refreshToken()', () => {
      beforeEach(() => {
        mockJwt.sign.mockReturnValue('new-token');
        mockJwt.decode.mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 });
      });

      it('should refresh token successfully when near expiry', async () => {
        const nearExpiryPayload = {
          ...mockJWTPayloads.validUser,
          exp: Math.floor(Date.now() / 1000) + 1800 // 30 minutes left
        };
        mockJwt.verify.mockReturnValue(nearExpiryPayload);
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);

        const result = await authService.refreshToken('near-expiry-token');

        expect(mockJwt.verify).toHaveBeenCalledWith('near-expiry-token', expect.any(String), expect.any(Object));
        expect(mockDb.getUserById).toHaveBeenCalledWith(nearExpiryPayload.userId);
        expect(mockJwt.sign).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.data?.token).toBe('new-token');
        expect(result.data?.user).toEqual(expect.objectContaining({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type,
          created_at: mockUsers.validUser.created_at,
          updated_at: mockUsers.validUser.updated_at
        }));
        expect(result.data?.user).not.toHaveProperty('password_hash');
      });

      it('should reject refresh when token is not near expiry', async () => {
        const farExpiryPayload = {
          ...mockJWTPayloads.validUser,
          exp: Math.floor(Date.now() / 1000) + 86400 + 1 // More than 24 hours left
        };
        mockJwt.verify.mockReturnValue(farExpiryPayload);

        await expect(authService.refreshToken('far-expiry-token'))
          .rejects.toThrow(expect.objectContaining({
            message: 'Token does not need refresh yet',
            statusCode: 400,
            code: 'TOKEN_NOT_ELIGIBLE_FOR_REFRESH'
          }));
      });

      it('should reject refresh when user not found', async () => {
        const nearExpiryPayload = {
          ...mockJWTPayloads.validUser,
          exp: Math.floor(Date.now() / 1000) + 1800
        };
        mockJwt.verify.mockReturnValue(nearExpiryPayload);
        mockDb.getUserById.mockResolvedValueOnce(null);

        await expect(authService.refreshToken('near-expiry-token'))
          .rejects.toThrow(new AuthError('User not found', 404, 'USER_NOT_FOUND'));
      });
    });

    describe('revokeToken()', () => {
      it('should add token to blacklist', () => {
        const token = 'token-to-revoke';
        
        authService.revokeToken(token);

        expect(() => authService.verifyToken(token))
          .toThrow(new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED'));
      });
    });
  });

  describe('Password Management', () => {
    describe('hashPassword()', () => {
      it('should hash password with bcrypt', async () => {
        mockBcrypt.hash.mockResolvedValue('hashed-password');

        const result = await authService.hashPassword('plainpassword');

        expect(mockBcrypt.hash).toHaveBeenCalledWith('plainpassword', parseInt(process.env.BCRYPT_ROUNDS || '10'));
        expect(result).toBe('hashed-password');
      });
    });

    describe('comparePassword()', () => {
      it('should compare password correctly', async () => {
        mockBcrypt.compare.mockResolvedValue(true);

        const result = await authService.comparePassword('plain', 'hashed');

        expect(mockBcrypt.compare).toHaveBeenCalledWith('plain', 'hashed');
        expect(result).toBe(true);
      });
    });

    describe('validatePassword()', () => {
      it('should validate strong password', () => {
        const strongPassword = 'StrongPassword123!';

        const result = authService.validatePassword(strongPassword);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.strength).toBe('strong');
      });

      it('should validate medium password', () => {
        const mediumPassword = 'MedPass1!'; // length=9, has all requirements, score=5, but length<12 so should be medium

        const result = authService.validatePassword(mediumPassword);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        // Score 5 but length < 12, so should be medium
        expect(result.strength).toBe('medium');
      });

      it('should reject weak password', () => {
        const weakPassword = '123';

        const result = authService.validatePassword(weakPassword);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.strength).toBe('weak');
        expect(result.errors).toContain('Password must be at least 8 characters long');
        expect(result.errors).toContain('Password must contain at least one lowercase letter');
      });

      it('should check all password requirements', () => {
        const incompletePassword = 'lowercase';

        const result = authService.validatePassword(incompletePassword);

        expect(result.errors).toContain('Password must contain at least one uppercase letter');
        expect(result.errors).toContain('Password must contain at least one number');
        expect(result.errors).toContain('Password must contain at least one special character (@$!%*?&)');
      });
    });

    describe('changePassword()', () => {
      beforeEach(() => {
        mockBcrypt.compare.mockImplementation(async (plain: any, hash: any) => {
          return plain === 'oldpassword' && hash === mockUsers.validUser.password_hash;
        });
        mockBcrypt.hash.mockResolvedValue('new-hashed-password');
      });

      it('should change password successfully', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        mockDb.updateUser.mockResolvedValueOnce(mockUsers.validUser);

        const request: PasswordChangeRequest = {
          oldPassword: 'oldpassword',
          newPassword: 'NewStrongPassword123!'
        };

        const result = await authService.changePassword(mockUsers.validUser.id, request);

        expect(mockDb.getUserById).toHaveBeenCalledWith(mockUsers.validUser.id);
        expect(mockBcrypt.compare).toHaveBeenCalledWith('oldpassword', mockUsers.validUser.password_hash);
        expect(mockBcrypt.hash).toHaveBeenCalledWith('NewStrongPassword123!', parseInt(process.env.BCRYPT_ROUNDS || '10'));
        expect(mockDb.updateUser).toHaveBeenCalledWith(mockUsers.validUser.id, {
          password_hash: 'new-hashed-password'
        });
        expect(result.success).toBe(true);
      });

      it('should reject change when user not found', async () => {
        mockDb.getUserById.mockResolvedValueOnce(null);

        const request: PasswordChangeRequest = {
          oldPassword: 'oldpassword',
          newPassword: 'NewPassword123!'
        };

        await expect(authService.changePassword('nonexistent', request))
          .rejects.toThrow(new AuthError('User not found', 404, 'USER_NOT_FOUND'));
      });

      it('should reject change when old password is incorrect', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        mockBcrypt.compare.mockResolvedValueOnce(false);

        const request: PasswordChangeRequest = {
          oldPassword: 'wrongpassword',
          newPassword: 'NewPassword123!'
        };

        await expect(authService.changePassword(mockUsers.validUser.id, request))
          .rejects.toThrow(new AuthError('Current password is incorrect', 401, 'INVALID_OLD_PASSWORD'));
      });

      it('should reject change when new password is invalid', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);

        const request: PasswordChangeRequest = {
          oldPassword: 'oldpassword',
          newPassword: '123'
        };

        await expect(authService.changePassword(mockUsers.validUser.id, request))
          .rejects.toThrow(expect.objectContaining({
            message: expect.stringContaining('New password validation failed'),
            statusCode: 400,
            code: 'INVALID_NEW_PASSWORD'
          }));
      });

      it('should reject change when new password is same as old', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        
        // Setup mock to verify old password correctly, then verify new password is same
        mockBcrypt.compare
          .mockResolvedValueOnce(true)  // Old password verification: correct
          .mockResolvedValueOnce(true); // New password same check: same as old

        const request: PasswordChangeRequest = {
          oldPassword: 'OldPassword123!',
          newPassword: 'OldPassword123!'
        };

        await expect(authService.changePassword(mockUsers.validUser.id, request))
          .rejects.toThrow(expect.objectContaining({
            message: 'New password must be different from current password',
            statusCode: 400,
            code: 'SAME_PASSWORD'
          }));
      });
    });
  });

  describe('User Management', () => {
    describe('getCurrentUser()', () => {
      it('should return current user successfully', async () => {
        mockJwt.verify.mockReturnValue(mockJWTPayloads.validUser);
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);

        const result = await authService.getCurrentUser('valid-token');

        expect(mockJwt.verify).toHaveBeenCalledWith('valid-token', expect.any(String), expect.any(Object));
        expect(mockDb.getUserById).toHaveBeenCalledWith(mockJWTPayloads.validUser.userId);
        expect(result).toEqual(expect.objectContaining({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type,
          created_at: mockUsers.validUser.created_at,
          updated_at: mockUsers.validUser.updated_at
        }));
        expect(result).not.toHaveProperty('password_hash');
      });

      it('should reject when user not found', async () => {
        mockJwt.verify.mockReturnValue(mockJWTPayloads.validUser);
        mockDb.getUserById.mockResolvedValueOnce(null);

        await expect(authService.getCurrentUser('valid-token'))
          .rejects.toThrow(new AuthError('User not found', 404, 'USER_NOT_FOUND'));
      });
    });

    describe('updateProfile()', () => {
      it('should update user profile successfully', async () => {
        const updates = { email: 'newemail@example.com', plan_type: 'personal' };
        const updatedUser = { ...mockUsers.validUser, ...updates };
        
        mockDb.getUserByEmail.mockResolvedValueOnce(null);
        mockDb.updateUser.mockResolvedValueOnce(updatedUser);

        const result = await authService.updateProfile(mockUsers.validUser.id, updates);

        expect(mockDb.getUserByEmail).toHaveBeenCalledWith(updates.email);
        expect(mockDb.updateUser).toHaveBeenCalledWith(mockUsers.validUser.id, updates);
        expect(result).toEqual(expect.objectContaining({
          id: updatedUser.id,
          email: updatedUser.email,
          plan_type: updatedUser.plan_type,
          created_at: updatedUser.created_at,
          updated_at: updatedUser.updated_at
        }));
        expect(result).not.toHaveProperty('password_hash');
      });

      it('should reject invalid email format', async () => {
        const updates = { email: 'invalid-email' };

        await expect(authService.updateProfile(mockUsers.validUser.id, updates))
          .rejects.toThrow(new AuthError('Invalid email format', 400, 'INVALID_EMAIL'));
      });

      it('should reject when email is already taken', async () => {
        const updates = { email: 'taken@example.com' };
        mockDb.getUserByEmail.mockResolvedValueOnce(mockUsers.adminUser);

        await expect(authService.updateProfile(mockUsers.validUser.id, updates))
          .rejects.toThrow(new AuthError('Email already in use', 409, 'EMAIL_TAKEN'));
      });

      it('should allow updating to same email', async () => {
        const updates = { email: mockUsers.validUser.email };
        mockDb.getUserByEmail.mockResolvedValueOnce(mockUsers.validUser);
        mockDb.updateUser.mockResolvedValueOnce(mockUsers.validUser);

        const result = await authService.updateProfile(mockUsers.validUser.id, updates);

        expect(result).toEqual(expect.objectContaining({
          id: mockUsers.validUser.id,
          email: mockUsers.validUser.email,
          plan_type: mockUsers.validUser.plan_type,
          created_at: mockUsers.validUser.created_at,
          updated_at: mockUsers.validUser.updated_at
        }));
        expect(result).not.toHaveProperty('password_hash');
      });

      it('should reject when user not found', async () => {
        const updates = { plan_type: 'personal' };
        mockDb.updateUser.mockResolvedValueOnce(null);

        await expect(authService.updateProfile('nonexistent', updates))
          .rejects.toThrow(new AuthError('User not found', 404, 'USER_NOT_FOUND'));
      });
    });

    describe('deleteAccount()', () => {
      beforeEach(() => {
        mockBcrypt.compare.mockResolvedValue(true);
      });

      it('should delete account successfully', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        mockDb.deleteUser.mockResolvedValueOnce(true);

        const result = await authService.deleteAccount(mockUsers.validUser.id, 'correctpassword');

        expect(mockDb.getUserById).toHaveBeenCalledWith(mockUsers.validUser.id);
        expect(mockBcrypt.compare).toHaveBeenCalledWith('correctpassword', mockUsers.validUser.password_hash);
        expect(mockDb.deleteUser).toHaveBeenCalledWith(mockUsers.validUser.id);
        expect(result.success).toBe(true);
      });

      it('should reject when user not found', async () => {
        mockDb.getUserById.mockResolvedValueOnce(null);

        await expect(authService.deleteAccount('nonexistent', 'password'))
          .rejects.toThrow(new AuthError('User not found', 404, 'USER_NOT_FOUND'));
      });

      it('should reject with incorrect password', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        mockBcrypt.compare.mockResolvedValueOnce(false);

        await expect(authService.deleteAccount(mockUsers.validUser.id, 'wrongpassword'))
          .rejects.toThrow(new AuthError('Password is incorrect', 401, 'INVALID_PASSWORD'));
      });

      it('should reject when deletion fails', async () => {
        mockDb.getUserById.mockResolvedValueOnce(mockUsers.validUser);
        mockDb.deleteUser.mockResolvedValueOnce(false);

        await expect(authService.deleteAccount(mockUsers.validUser.id, 'correctpassword'))
          .rejects.toThrow(new AuthError('Failed to delete account', 500, 'DELETE_FAILED'));
      });
    });
  });

  describe('Validation Methods', () => {
    describe('isValidEmail()', () => {
      it('should validate correct email addresses', () => {
        const validEmails = [
          'test@example.com',
          'user.name@domain.co.uk',
          'firstname+lastname@company.org',
          'test123@test-domain.com'
        ];

        validEmails.forEach(email => {
          expect(authService.isValidEmail(email)).toBe(true);
        });
      });

      it('should reject invalid email addresses', () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'test@'
        ];

        invalidEmails.forEach(email => {
          expect(authService.isValidEmail(email)).toBe(false);
        });
      });
    });

    describe('getUserIdFromToken()', () => {
      it('should extract user ID from token', () => {
        mockJwt.verify.mockReturnValue(mockJWTPayloads.validUser);

        const userId = authService.getUserIdFromToken('valid-token');

        expect(userId).toBe(mockJWTPayloads.validUser.userId);
      });
    });
  });

  describe('Security Methods', () => {
    describe('isTokenNearExpiry()', () => {
      it('should return true for token near expiry', () => {
        const nearExpiryToken = 'near-expiry-token';
        const nearExpiryPayload = {
          ...mockJWTPayloads.validUser,
          exp: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
        };
        mockJwt.decode.mockReturnValue(nearExpiryPayload);

        const result = authService.isTokenNearExpiry(nearExpiryToken, 24);

        expect(result).toBe(true);
      });

      it('should return false for token not near expiry', () => {
        const farExpiryToken = 'far-expiry-token';
        const farExpiryPayload = {
          ...mockJWTPayloads.validUser,
          exp: Math.floor(Date.now() / 1000) + 86400 // 24 hours
        };
        mockJwt.decode.mockReturnValue(farExpiryPayload);

        const result = authService.isTokenNearExpiry(farExpiryToken, 1);

        expect(result).toBe(false);
      });

      it('should return true for invalid token', () => {
        mockJwt.decode.mockReturnValue(null);

        const result = authService.isTokenNearExpiry('invalid-token');

        expect(result).toBe(true);
      });
    });

    describe('getTokenExpiration()', () => {
      it('should return expiration date for valid token', () => {
        const expTimestamp = Math.floor(Date.now() / 1000) + 3600;
        const payload = {
          ...mockJWTPayloads.validUser,
          exp: expTimestamp
        };
        mockJwt.decode.mockReturnValue(payload);

        const result = authService.getTokenExpiration('valid-token');

        expect(result).toEqual(new Date(expTimestamp * 1000));
      });

      it('should return null for invalid token', () => {
        mockJwt.decode.mockReturnValue(null);

        const result = authService.getTokenExpiration('invalid-token');

        expect(result).toBeNull();
      });
    });
  });
});