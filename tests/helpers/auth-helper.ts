import jwt from 'jsonwebtoken';
import { JWTPayload } from '../../src/types';

/**
 * Test helpers for authentication
 */
export class AuthTestHelper {
  private static readonly TEST_JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  private static readonly TEST_JWT_EXPIRES_IN = '1h';

  /**
   * Generate a valid test JWT token
   */
  static generateTestToken(payload: Partial<JWTPayload> = {}): string {
    const defaultPayload: JWTPayload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      planType: 'free',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iss: 'coderunner-api',
      aud: 'coderunner-client'
    };

    const tokenPayload = { ...defaultPayload, ...payload };
    
    return jwt.sign(tokenPayload, AuthTestHelper.TEST_JWT_SECRET, {
      issuer: 'coderunner-api',
      audience: 'coderunner-client'
    });
  }

  /**
   * Generate an expired test JWT token
   */
  static generateExpiredToken(payload: Partial<JWTPayload> = {}): string {
    const expiredPayload: JWTPayload = {
      userId: 'test-user-123',
      email: 'test@example.com',
      planType: 'free',
      iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
      exp: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago (expired)
      iss: 'coderunner-api',
      aud: 'coderunner-client'
    };

    const tokenPayload = { ...expiredPayload, ...payload };
    
    return jwt.sign(tokenPayload, AuthTestHelper.TEST_JWT_SECRET, {
      issuer: 'coderunner-api',
      audience: 'coderunner-client'
    });
  }

  /**
   * Generate a malformed token
   */
  static generateMalformedToken(): string {
    return 'malformed.jwt.token.that.is.invalid';
  }

  /**
   * Create authorization header for tests
   */
  static createAuthHeader(token?: string): { Authorization: string } {
    const testToken = token || AuthTestHelper.generateTestToken();
    return {
      Authorization: `Bearer ${testToken}`
    };
  }

  /**
   * Create test user object for authenticated requests
   */
  static createTestUser(overrides: Partial<JWTPayload> = {}): JWTPayload {
    return {
      userId: 'test-user-123',
      email: 'test@example.com',
      planType: 'free',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      iss: 'coderunner-api',
      aud: 'coderunner-client',
      ...overrides
    };
  }

  /**
   * Create test request with authentication
   */
  static withAuth(request: any, token?: string) {
    const headers = AuthTestHelper.createAuthHeader(token);
    return request.set(headers);
  }

  /**
   * Setup test environment variables
   */
  static setupTestEnv(): void {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = AuthTestHelper.TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = AuthTestHelper.TEST_JWT_EXPIRES_IN;
    process.env.BCRYPT_ROUNDS = '4'; // Faster for tests
    process.env.SKIP_RATE_LIMIT = 'true'; // Skip rate limiting in tests
  }

  /**
   * Cleanup test environment
   */
  static cleanupTestEnv(): void {
    delete process.env.SKIP_RATE_LIMIT;
    // Keep other env vars as they might be needed by other tests
  }

  /**
   * Validate token structure (for testing token generation)
   */
  static validateTokenStructure(token: string): boolean {
    try {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return false;
      }

      const payload = decoded.payload as any;
      return !!(
        payload.userId &&
        payload.email &&
        payload.planType &&
        payload.iat &&
        payload.exp &&
        payload.iss === 'coderunner-api' &&
        payload.aud === 'coderunner-client'
      );
    } catch {
      return false;
    }
  }

  /**
   * Create mock user data for registration tests
   */
  static createMockRegistrationData(overrides: any = {}) {
    return {
      email: 'test@example.com',
      password: 'TestPassword123!',
      planType: 'free',
      ...overrides
    };
  }

  /**
   * Create mock login credentials for login tests
   */
  static createMockLoginCredentials(overrides: any = {}) {
    return {
      email: 'test@example.com',
      password: 'TestPassword123!',
      ...overrides
    };
  }

  /**
   * Decode token without verification (for testing)
   */
  static decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch {
      return null;
    }
  }
}

export default AuthTestHelper;