import jwt from 'jsonwebtoken';
import { JWTPayload, AuthResponse, AuthError } from '../../src/types';
import { mockUsers, mockJWTPayloads, withoutPassword } from '../fixtures/users';

/**
 * Mock implementations for AuthService for unit testing
 */

export class MockAuthService {
  private static mockTokenBlacklist = new Set<string>();

  static clearBlacklist(): void {
    this.mockTokenBlacklist.clear();
  }

  static addToBlacklist(token: string): void {
    this.mockTokenBlacklist.add(token);
  }

  static getBlacklist(): Set<string> {
    return this.mockTokenBlacklist;
  }

  static createMockToken(payload: Partial<JWTPayload> = {}): string {
    const mockPayload = {
      ...mockJWTPayloads.validUser,
      ...payload
    };
    return jwt.sign(mockPayload, 'test-jwt-secret-key-for-testing-only');
  }

  static createExpiredToken(): string {
    return jwt.sign(mockJWTPayloads.expiredUser, 'test-jwt-secret-key-for-testing-only');
  }

  static createInvalidToken(): string {
    return 'invalid.jwt.token';
  }
}

// Mock bcrypt functions
export const mockBcrypt = {
  hash: jest.fn().mockImplementation(async (password: string, rounds: number) => {
    return `$2b$${rounds}$mocked.hash.${password}`;
  }),
  
  compare: jest.fn().mockImplementation(async (password: string, hash: string) => {
    // Simple mock logic - return true if password appears in hash
    return hash.includes(password) || 
           (password === 'testpassword123' && hash.includes('K1wUJn2JZ')) ||
           (password === 'wrongpassword' && false);
  })
};

// Mock AuthService methods
export const createMockAuthService = () => {
  const mockAuthService = {
    // Core authentication
    register: jest.fn().mockImplementation(async (input) => {
      if (input.email === 'existing@example.com') {
        throw new AuthError('User with this email already exists', 409, 'USER_EXISTS');
      }
      if (input.email === 'invalid-email') {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }
      if (input.password === '123') {
        throw new AuthError('Password validation failed', 400, 'INVALID_PASSWORD');
      }
      
      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser) as Omit<User, 'password_hash'>,
          token: MockAuthService.createMockToken(),
          expiresAt: new Date(Date.now() + 3600000) // 1 hour
        },
        message: 'User registered successfully'
      };
      return mockResponse;
    }),

    login: jest.fn().mockImplementation(async (credentials) => {
      if (credentials.email === 'invalid-email') {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }
      if (credentials.email === 'nonexistent@example.com') {
        throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }
      if (credentials.password === 'wrongpassword') {
        throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }
      if (!credentials.password) {
        throw new AuthError('Password is required', 400, 'PASSWORD_REQUIRED');
      }

      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser) as Omit<User, 'password_hash'>,
          token: MockAuthService.createMockToken(),
          expiresAt: new Date(Date.now() + 3600000)
        },
        message: 'Login successful'
      };
      return mockResponse;
    }),

    // Token management
    generateToken: jest.fn().mockImplementation((user) => {
      return MockAuthService.createMockToken({
        userId: user.id,
        email: user.email,
        planType: user.plan_type
      });
    }),

    verifyToken: jest.fn().mockImplementation((token: string) => {
      if (MockAuthService.getBlacklist().has(token)) {
        throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }
      if (token === MockAuthService.createInvalidToken()) {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      }
      if (token === MockAuthService.createExpiredToken()) {
        throw new AuthError('Token has expired', 401, 'TOKEN_EXPIRED');
      }
      return mockJWTPayloads.validUser;
    }),

    decodeToken: jest.fn().mockImplementation((token: string) => {
      if (token === MockAuthService.createInvalidToken()) {
        return null;
      }
      try {
        return jwt.decode(token) as JWTPayload;
      } catch {
        return null;
      }
    }),

    refreshToken: jest.fn().mockImplementation(async (oldToken: string) => {
      const mockResponse: AuthResponse = {
        success: true,
        data: {
          user: withoutPassword(mockUsers.validUser) as Omit<User, 'password_hash'>,
          token: MockAuthService.createMockToken(),
          expiresAt: new Date(Date.now() + 3600000)
        },
        message: 'Token refreshed successfully'
      };
      
      MockAuthService.addToBlacklist(oldToken);
      return mockResponse;
    }),

    revokeToken: jest.fn().mockImplementation((token: string) => {
      MockAuthService.addToBlacklist(token);
    }),

    // Password management
    hashPassword: jest.fn().mockImplementation(async (password: string) => {
      return mockBcrypt.hash(password, 10);
    }),

    comparePassword: jest.fn().mockImplementation(async (plain: string, hash: string) => {
      return mockBcrypt.compare(plain, hash);
    }),

    changePassword: jest.fn().mockImplementation(async (_userId: string, request) => {
      if (request.oldPassword === 'wrongpassword') {
        throw new AuthError('Current password is incorrect', 401, 'INVALID_OLD_PASSWORD');
      }
      if (request.newPassword === '123') {
        throw new AuthError('New password validation failed', 400, 'INVALID_NEW_PASSWORD');
      }
      if (request.oldPassword === request.newPassword) {
        throw new AuthError('New password must be different from current password', 400, 'SAME_PASSWORD');
      }

      return {
        success: true,
        message: 'Password changed successfully'
      };
    }),

    validatePassword: jest.fn().mockImplementation((password: string) => {
      const errors: string[] = [];
      let score = 0;

      if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
      } else {
        score += 1;
      }

      if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
      } else {
        score += 1;
      }

      if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
      } else {
        score += 1;
      }

      if (!/\d/.test(password)) {
        errors.push('Password must contain at least one number');
      } else {
        score += 1;
      }

      if (!/[@$!%*?&]/.test(password)) {
        errors.push('Password must contain at least one special character (@$!%*?&)');
      } else {
        score += 1;
      }

      let strength: 'weak' | 'medium' | 'strong' = 'weak';
      if (score >= 4) strength = 'medium';
      if (score === 5 && password.length >= 12) strength = 'strong';

      return {
        isValid: errors.length === 0,
        errors,
        strength
      };
    }),

    // User management
    getCurrentUser: jest.fn().mockImplementation(async (_token: string) => {
      return withoutPassword(mockUsers.validUser);
    }),

    updateProfile: jest.fn().mockImplementation(async (_userId: string, updates) => {
      if (updates.email === 'invalid-email') {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }
      if (updates.email === 'taken@example.com') {
        throw new AuthError('Email already in use', 409, 'EMAIL_TAKEN');
      }
      
      const updatedUser = {
        ...mockUsers.validUser,
        ...updates
      };
      
      return withoutPassword(updatedUser);
    }),

    deleteAccount: jest.fn().mockImplementation(async (_userId: string, password: string) => {
      if (password === 'wrongpassword') {
        throw new AuthError('Password is incorrect', 401, 'INVALID_PASSWORD');
      }

      return {
        success: true,
        message: 'Account deleted successfully'
      };
    }),

    // Validation methods
    isValidEmail: jest.fn().mockImplementation((email: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email) && email.length <= 254;
    }),

    getUserIdFromToken: jest.fn().mockImplementation((_token: string) => {
      return mockJWTPayloads.validUser.userId;
    }),

    // Security methods
    isTokenNearExpiry: jest.fn().mockImplementation((token: string, _windowHours = 24) => {
      // Mock logic for testing
      if (token === MockAuthService.createMockToken(mockJWTPayloads.nearExpiryUser)) {
        return true;
      }
      return false;
    }),

    getTokenExpiration: jest.fn().mockImplementation((token: string) => {
      if (token === MockAuthService.createInvalidToken()) {
        return null;
      }
      return new Date(Date.now() + 3600000); // 1 hour from now
    })
  };

  return mockAuthService;
};

// Helper to mock AuthService.getInstance()
export const mockAuthServiceInstance = () => {
  const mockAuth = createMockAuthService();
  return mockAuth;
};

// Mock request/response objects for middleware testing
export const createMockRequest = (overrides: any = {}) => ({
  headers: {},
  body: {},
  params: {},
  user: undefined,
  ip: '127.0.0.1',
  ...overrides
});

export const createMockResponse = () => {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis()
  };
  return res;
};

export const createMockNext = () => jest.fn();

// Reset function for test cleanup
export const resetAuthMocks = () => {
  jest.restoreAllMocks();
  MockAuthService.clearBlacklist();
};