import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { 
  User, 
  JWTPayload, 
  AuthError, 
  LoginCredentials, 
  RegisterInput, 
  AuthResponse,
  PasswordChangeRequest,
  PasswordValidation
} from '../types';
import { DatabaseService } from './database';

export class AuthService {
  private static instance: AuthService;
  private db: DatabaseService;
  private tokenBlacklist: Set<string> = new Set();

  // Configuration
  private static readonly JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';
  private static readonly JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
  private static readonly BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');
  
  private constructor() {
    this.db = DatabaseService.getInstance();
    
    if (AuthService.JWT_SECRET === 'fallback-secret-key') {
      console.warn('⚠️ Using fallback JWT secret. Set JWT_SECRET in environment variables.');
    }
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ========================================
  // CORE AUTHENTICATION METHODS
  // ========================================

  /**
   * Register a new user
   */
  public async register(input: RegisterInput): Promise<AuthResponse> {
    try {
      const { email, password, planType = 'free' } = input;

      // Validate input
      if (!this.isValidEmail(email)) {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        throw new AuthError(
          `Password validation failed: ${passwordValidation.errors.join(', ')}`,
          400,
          'INVALID_PASSWORD'
        );
      }

      // Check if user already exists
      const existingUser = await this.db.getUserByEmail(email);
      if (existingUser) {
        throw new AuthError('User with this email already exists', 409, 'USER_EXISTS');
      }

      // Hash password
      const passwordHash = await this.hashPassword(password);

      // Create user
      const newUser = await this.db.createUser({
        email,
        password_hash: passwordHash,
        plan_type: planType
      });

      // Generate token
      const token = this.generateToken({
        id: newUser.id,
        email: newUser.email,
        plan_type: newUser.plan_type
      });

      // Calculate expiration
      const decoded = jwt.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      return {
        success: true,
        data: {
          user: {
            id: newUser.id,
            email: newUser.email,
            plan_type: newUser.plan_type,
            created_at: newUser.created_at,
            updated_at: newUser.updated_at
          },
          token,
          expiresAt
        },
        message: 'User registered successfully'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Registration failed', 500, 'REGISTRATION_FAILED');
    }
  }

  /**
   * Login user
   */
  public async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { email, password } = credentials;

      // Validate input
      if (!this.isValidEmail(email)) {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      if (!password) {
        throw new AuthError('Password is required', 400, 'PASSWORD_REQUIRED');
      }

      // Get user by email
      const user = await this.db.getUserByEmail(email);
      if (!user) {
        // Use same timing to prevent email enumeration attacks
        await bcrypt.hash(password, AuthService.BCRYPT_ROUNDS);
        throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Verify password
      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AuthError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
      }

      // Generate token
      const token = this.generateToken({
        id: user.id,
        email: user.email,
        plan_type: user.plan_type
      });

      // Calculate expiration
      const decoded = jwt.decode(token) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            plan_type: user.plan_type,
            created_at: user.created_at,
            updated_at: user.updated_at
          },
          token,
          expiresAt
        },
        message: 'Login successful'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Login failed', 500, 'LOGIN_FAILED');
    }
  }

  // ========================================
  // TOKEN MANAGEMENT METHODS
  // ========================================

  /**
   * Generate JWT token for user
   */
  public generateToken(user: { id: string; email: string; plan_type: string }): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      planType: user.plan_type
    };

    return jwt.sign(payload, AuthService.JWT_SECRET, {
      expiresIn: AuthService.JWT_EXPIRES_IN,
      issuer: 'coderunner-api',
      audience: 'coderunner-client'
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token
   */
  public verifyToken(token: string): JWTPayload {
    try {
      // Check if token is blacklisted
      if (this.tokenBlacklist.has(token)) {
        throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }

      const payload = jwt.verify(token, AuthService.JWT_SECRET, {
        issuer: 'coderunner-api',
        audience: 'coderunner-client'
      }) as JWTPayload;

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthError('Token has expired', 401, 'TOKEN_EXPIRED');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      }
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Token verification failed', 401, 'TOKEN_VERIFICATION_FAILED');
    }
  }

  /**
   * Decode token without verification (for extracting info)
   */
  public decodeToken(token: string): JWTPayload | null {
    try {
      return jwt.decode(token) as JWTPayload;
    } catch (error) {
      return null;
    }
  }

  /**
   * Refresh token if it's close to expiration
   */
  public async refreshToken(oldToken: string): Promise<AuthResponse> {
    try {
      const payload = this.verifyToken(oldToken);
      
      // Check if token is within refresh window (e.g., less than 24 hours left)
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp! - now;
      const refreshWindow = 24 * 60 * 60; // 24 hours
      
      if (timeUntilExpiry > refreshWindow) {
        throw new AuthError('Token does not need refresh yet', 400, 'TOKEN_NOT_ELIGIBLE_FOR_REFRESH');
      }

      // Get fresh user data
      const user = await this.db.getUserById(payload.userId);
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Generate new token
      const newToken = this.generateToken({
        id: user.id,
        email: user.email,
        plan_type: user.plan_type
      });

      // Blacklist old token
      this.tokenBlacklist.add(oldToken);

      // Calculate expiration
      const decoded = jwt.decode(newToken) as any;
      const expiresAt = new Date(decoded.exp * 1000);

      return {
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            plan_type: user.plan_type,
            created_at: user.created_at,
            updated_at: user.updated_at
          },
          token: newToken,
          expiresAt
        },
        message: 'Token refreshed successfully'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Token refresh failed', 500, 'TOKEN_REFRESH_FAILED');
    }
  }

  /**
   * Revoke/blacklist a token
   */
  public revokeToken(token: string): void {
    this.tokenBlacklist.add(token);
    // TODO: In production, store blacklisted tokens in database with expiration
  }

  // ========================================
  // PASSWORD MANAGEMENT METHODS
  // ========================================

  /**
   * Hash password using bcrypt
   */
  public async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, AuthService.BCRYPT_ROUNDS);
  }

  /**
   * Compare password with hash
   */
  public async comparePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Change user password
   */
  public async changePassword(userId: string, request: PasswordChangeRequest): Promise<{ success: boolean; message: string }> {
    try {
      const { oldPassword, newPassword } = request;

      // Get user
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify old password
      const isOldPasswordValid = await this.comparePassword(oldPassword, user.password_hash);
      if (!isOldPasswordValid) {
        throw new AuthError('Current password is incorrect', 401, 'INVALID_OLD_PASSWORD');
      }

      // Validate new password
      const passwordValidation = this.validatePassword(newPassword);
      if (!passwordValidation.isValid) {
        throw new AuthError(
          `New password validation failed: ${passwordValidation.errors.join(', ')}`,
          400,
          'INVALID_NEW_PASSWORD'
        );
      }

      // Check if new password is different from old
      const isSamePassword = await this.comparePassword(newPassword, user.password_hash);
      if (isSamePassword) {
        throw new AuthError('New password must be different from current password', 400, 'SAME_PASSWORD');
      }

      // Hash new password
      const newPasswordHash = await this.hashPassword(newPassword);

      // Update password
      await this.db.updateUser(userId, { password_hash: newPasswordHash });

      return {
        success: true,
        message: 'Password changed successfully'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Password change failed', 500, 'PASSWORD_CHANGE_FAILED');
    }
  }

  /**
   * Validate password strength
   */
  public validatePassword(password: string): PasswordValidation {
    const errors: string[] = [];
    let score = 0;

    // Length check
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      score += 1;
    }

    // Character variety checks
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

    // Determine strength
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (score >= 4) strength = 'medium';
    if (score === 5 && password.length >= 12) strength = 'strong';

    return {
      isValid: errors.length === 0,
      errors,
      strength
    };
  }

  // ========================================
  // USER MANAGEMENT METHODS
  // ========================================

  /**
   * Get current user from token
   */
  public async getCurrentUser(token: string): Promise<Omit<User, 'password_hash'>> {
    try {
      const payload = this.verifyToken(token);
      const user = await this.db.getUserById(payload.userId);
      
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Return user without password hash
      const { password_hash: _, ...userWithoutPassword } = user;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Failed to get current user', 500, 'GET_USER_FAILED');
    }
  }

  /**
   * Update user profile
   */
  public async updateProfile(userId: string, updates: { email?: string; plan_type?: string }): Promise<Omit<User, 'password_hash'>> {
    try {
      // Validate email if provided
      if (updates.email && !this.isValidEmail(updates.email)) {
        throw new AuthError('Invalid email format', 400, 'INVALID_EMAIL');
      }

      // Check if email is already taken (if updating email)
      if (updates.email) {
        const existingUser = await this.db.getUserByEmail(updates.email);
        if (existingUser && existingUser.id !== userId) {
          throw new AuthError('Email already in use', 409, 'EMAIL_TAKEN');
        }
      }

      // Update user
      const updatedUser = await this.db.updateUser(userId, updates);
      if (!updatedUser) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Return user without password hash
      const { password_hash: _, ...userWithoutPassword } = updatedUser;
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Profile update failed', 500, 'PROFILE_UPDATE_FAILED');
    }
  }

  /**
   * Delete user account
   */
  public async deleteAccount(userId: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      // Get user
      const user = await this.db.getUserById(userId);
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Verify password
      const isPasswordValid = await this.comparePassword(password, user.password_hash);
      if (!isPasswordValid) {
        throw new AuthError('Password is incorrect', 401, 'INVALID_PASSWORD');
      }

      // Delete user (cascade will handle related data)
      const deleted = await this.db.deleteUser(userId);
      if (!deleted) {
        throw new AuthError('Failed to delete account', 500, 'DELETE_FAILED');
      }

      return {
        success: true,
        message: 'Account deleted successfully'
      };
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Account deletion failed', 500, 'ACCOUNT_DELETION_FAILED');
    }
  }

  // ========================================
  // VALIDATION METHODS
  // ========================================

  /**
   * Validate email format
   */
  public isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  /**
   * Extract user ID from request (for middleware use)
   */
  public getUserIdFromToken(token: string): string {
    const payload = this.verifyToken(token);
    return payload.userId;
  }

  // ========================================
  // SECURITY METHODS
  // ========================================

  /**
   * Check if token is close to expiration
   */
  public isTokenNearExpiry(token: string, windowHours: number = 24): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return true;

      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = payload.exp - now;
      const windowSeconds = windowHours * 60 * 60;

      return timeUntilExpiry <= windowSeconds;
    } catch {
      return true;
    }
  }

  /**
   * Get token expiration date
   */
  public getTokenExpiration(token: string): Date | null {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.exp) return null;
      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }
}

// Export both named and default exports for compatibility
export default AuthService;