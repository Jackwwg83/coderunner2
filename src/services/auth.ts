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
  private refreshTokenBlacklist: Set<string> = new Set();
  private activeSessions: Map<string, { userId: string; createdAt: Date; lastAccess: Date }> = new Map();

  // Configuration
  private static get JWT_SECRET(): string {
    return process.env.JWT_SECRET || 'fallback-secret-key';
  }
  
  private static get JWT_EXPIRES_IN(): string {
    return process.env.JWT_EXPIRES_IN || '7d';
  }
  
  private static get BCRYPT_ROUNDS(): number {
    return parseInt(process.env.BCRYPT_ROUNDS || '10');
  }
  
  private constructor() {
    this.db = DatabaseService.getInstance();
    
    if (AuthService.JWT_SECRET === 'fallback-secret-key' && process.env.NODE_ENV !== 'test') {
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
   * Register a new user with enhanced security
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

      // Generate tokens
      const accessToken = this.generateToken({
        id: newUser.id,
        email: newUser.email,
        plan_type: newUser.plan_type
      });
      
      const refreshToken = this.generateRefreshToken(newUser.id);

      // Calculate expiration
      const decoded = jwt.decode(accessToken) as any;
      const expiresAt = new Date((decoded?.exp || Math.floor(Date.now() / 1000) + 3600) * 1000);

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
          token: accessToken,
          refreshToken,
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
   * Login user with enhanced security
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

      // Generate tokens
      const accessToken = this.generateToken({
        id: user.id,
        email: user.email,
        plan_type: user.plan_type
      });
      
      const refreshToken = this.generateRefreshToken(user.id);

      // Calculate expiration
      const decoded = jwt.decode(accessToken) as any;
      const expiresAt = new Date((decoded?.exp || Math.floor(Date.now() / 1000) + 3600) * 1000);

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
          token: accessToken,
          refreshToken,
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
   * Generate JWT token for user with session tracking
   */
  public generateToken(user: { id: string; email: string; plan_type: string }): string {
    const now = Math.floor(Date.now() / 1000);
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      planType: user.plan_type,
      iat: now,
      jti: require('crypto').randomUUID() // JWT ID for tracking
    };

    const token = jwt.sign(payload, AuthService.JWT_SECRET, {
      expiresIn: AuthService.JWT_EXPIRES_IN,
      issuer: 'coderunner-api',
      audience: 'coderunner-client'
    } as jwt.SignOptions);

    // Track active session
    const sessionKey = `${user.id}:${now}`;
    this.activeSessions.set(sessionKey, {
      userId: user.id,
      createdAt: new Date(),
      lastAccess: new Date()
    });

    return token;
  }

  /**
   * Generate refresh token
   */
  public generateRefreshToken(userId: string): string {
    const payload = {
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: require('crypto').randomUUID()
    };

    return jwt.sign(payload, AuthService.JWT_SECRET, {
      expiresIn: '30d', // Refresh tokens last 30 days
      issuer: 'coderunner-api',
      audience: 'coderunner-client'
    } as jwt.SignOptions);
  }

  /**
   * Verify JWT token with enhanced security checks
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

      // Update session activity
      if (payload.iat) {
        const sessionKey = `${payload.userId}:${payload.iat}`;
        const session = this.activeSessions.get(sessionKey);
        if (session) {
          session.lastAccess = new Date();
        }
      }

      // Additional security checks
      this.validateTokenSecurity(payload);

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
   * Validate token security properties
   */
  private validateTokenSecurity(payload: JWTPayload): void {
    const now = Math.floor(Date.now() / 1000);
    
    // Check if token is too old (beyond normal expiry)
    if (payload.iat && (now - payload.iat) > 30 * 24 * 60 * 60) { // 30 days
      throw new AuthError('Token is too old', 401, 'TOKEN_TOO_OLD');
    }

    // Validate token structure
    if (!payload.userId || !payload.email || !payload.planType) {
      throw new AuthError('Invalid token structure', 401, 'INVALID_TOKEN_STRUCTURE');
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
   * Refresh token with enhanced security
   */
  public async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      if (this.refreshTokenBlacklist.has(refreshToken)) {
        throw new AuthError('Refresh token has been revoked', 401, 'REFRESH_TOKEN_REVOKED');
      }

      const payload = jwt.verify(refreshToken, AuthService.JWT_SECRET, {
        issuer: 'coderunner-api',
        audience: 'coderunner-client'
      }) as any;

      if (payload.type !== 'refresh') {
        throw new AuthError('Invalid refresh token type', 401, 'INVALID_REFRESH_TOKEN');
      }

      // Get fresh user data
      const user = await this.db.getUserById(payload.userId);
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Generate new access token and refresh token
      const newAccessToken = this.generateToken({
        id: user.id,
        email: user.email,
        plan_type: user.plan_type
      });
      
      const newRefreshToken = this.generateRefreshToken(user.id);

      // Blacklist old refresh token
      this.refreshTokenBlacklist.add(refreshToken);

      // Calculate expiration
      const decoded = jwt.decode(newAccessToken) as any;
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
          token: newAccessToken,
          refreshToken: newRefreshToken,
          expiresAt
        },
        message: 'Tokens refreshed successfully'
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
      }
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Token refresh failed', 500, 'TOKEN_REFRESH_FAILED');
    }
  }

  /**
   * Logout user and revoke tokens
   */
  public logout(accessToken: string, refreshToken?: string): { success: boolean; message: string } {
    try {
      // Revoke access token
      this.revokeToken(accessToken, 'logout');
      
      // Revoke refresh token if provided
      if (refreshToken) {
        this.refreshTokenBlacklist.add(refreshToken);
      }

      return {
        success: true,
        message: 'Logged out successfully'
      };
    } catch (error) {
      return {
        success: true, // Always return success for logout
        message: 'Logged out successfully'
      };
    }
  }

  /**
   * Revoke/blacklist a token
   */
  public revokeToken(token: string, reason: 'logout' | 'password_change' | 'account_deletion' = 'logout'): void {
    this.tokenBlacklist.add(token);
    
    // Remove from active sessions
    try {
      const payload = this.decodeToken(token);
      if (payload) {
        const sessionKey = `${payload.userId}:${payload.iat}`;
        this.activeSessions.delete(sessionKey);
      }
    } catch (error) {
      // Ignore decode errors for blacklisting
    }
    
    console.log(`Token revoked - Reason: ${reason}, Time: ${new Date().toISOString()}`);
    // TODO: In production, store blacklisted tokens in database with expiration
  }

  /**
   * Revoke all tokens for a user (e.g., on password change)
   */
  public revokeAllUserTokens(userId: string, reason: 'password_change' | 'account_deletion' = 'password_change'): void {
    // Remove all active sessions for the user
    for (const [sessionKey, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        this.activeSessions.delete(sessionKey);
      }
    }
    
    console.log(`All tokens revoked for user ${userId} - Reason: ${reason}`);
    // TODO: In production, add all user tokens to blacklist from database
  }

  /**
   * Check if token is blacklisted
   */
  public isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }

  /**
   * Clean up expired tokens from blacklist (memory management)
   */
  public cleanupExpiredTokens(): void {
    // This would be implemented with database storage in production
    // For now, we'll clear the in-memory blacklist periodically
    if (this.tokenBlacklist.size > 10000) {
      this.tokenBlacklist.clear();
      console.log('Token blacklist cleared due to size limit');
    }
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
   * Change user password with enhanced security
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

      // Revoke all existing tokens for security
      this.revokeAllUserTokens(userId, 'password_change');

      return {
        success: true,
        message: 'Password changed successfully. Please log in again.'
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

    if (!password) {
      return {
        isValid: false,
        errors: ['Password is required'],
        strength: 'weak'
      };
    }

    // Length check - be strict
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    } else {
      score += 1;
      if (password.length >= 12) score += 1; // Bonus for longer passwords
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

    // Common password check
    const commonPasswords = [
      'password', '12345678', 'qwerty123', 'password123', 'admin123',
      'letmein123', '123456789', 'welcome123', 'changeme123', 'abc123456',
      'password1', '123123123', 'qwertyuiop', 'asdfghjkl', 'password!',
      '12345678', 'qwertyui', 'asdfghjk', 'zxcvbnm1', 'iloveyou1'
    ];
    
    if (commonPasswords.includes(password.toLowerCase())) {
      errors.push('Password is too common. Please choose a stronger password.');
      score = 0; // Reset score for common passwords
    }

    // Sequential or repeated characters check
    if (/123456|654321|abcdef|qwerty|password/i.test(password)) {
      errors.push('Password should not contain sequential characters or common patterns');
      score = Math.max(0, score - 2);
    }

    // Repeated character check
    if (/(..).*\1/.test(password) || /(.{3,}).*\1/.test(password)) {
      errors.push('Password should not contain repeated patterns');
      score = Math.max(0, score - 1);
    }

    // Determine strength based on enhanced scoring
    let strength: 'weak' | 'medium' | 'strong' = 'weak';
    if (score >= 4 && errors.length === 0) strength = 'medium';
    if (score >= 6 && password.length >= 12 && errors.length === 0) strength = 'strong';

    return {
      isValid: errors.length === 0 && score >= 5, // Require all criteria + bonus
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

  /**
   * Get active sessions for a user
   */
  public getActiveSessions(userId: string): Array<{ createdAt: Date; lastAccess: Date }> {
    const sessions: Array<{ createdAt: Date; lastAccess: Date }> = [];
    
    for (const [sessionKey, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        sessions.push({
          createdAt: session.createdAt,
          lastAccess: session.lastAccess
        });
      }
    }
    
    return sessions.sort((a, b) => b.lastAccess.getTime() - a.lastAccess.getTime());
  }

  /**
   * Clean up expired sessions
   */
  public cleanupExpiredSessions(): void {
    const now = Date.now();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    
    for (const [sessionKey, session] of this.activeSessions.entries()) {
      if (now - session.lastAccess.getTime() > sessionTimeout) {
        this.activeSessions.delete(sessionKey);
      }
    }
  }

  /**
   * Validate session security
   */
  public validateSession(token: string): boolean {
    try {
      const payload = this.decodeToken(token);
      if (!payload || !payload.iat) return false;
      
      const sessionKey = `${payload.userId}:${payload.iat}`;
      return this.activeSessions.has(sessionKey);
    } catch {
      return false;
    }
  }

  /**
   * Update user profile
   */
  public async updateUserProfile(token: string, updateData: any): Promise<User> {
    try {
      if (this.tokenBlacklist.has(token)) {
        throw new AuthError('Token has been revoked', 401, 'TOKEN_REVOKED');
      }

      const payload = this.decodeToken(token);
      if (!payload) {
        throw new AuthError('Invalid token', 401, 'INVALID_TOKEN');
      }

      const user = await this.db.getUserById(payload.userId);
      if (!user) {
        throw new AuthError('User not found', 404, 'USER_NOT_FOUND');
      }

      // Update allowed fields
      const allowedFields = ['name', 'bio', 'location', 'website'];
      const updates: any = {};
      
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) {
          updates[field] = updateData[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return user; // No updates needed
      }

      // Update user in database
      const updatedUser = await this.db.updateUser(user.id, updates);
      if (!updatedUser) {
        throw new AuthError('Failed to update user', 500, 'UPDATE_FAILED');
      }

      return updatedUser;
    } catch (error) {
      if (error instanceof AuthError) {
        throw error;
      }
      throw new AuthError('Profile update failed', 500, 'UPDATE_PROFILE_FAILED');
    }
  }
}

// Export both named and default exports for compatibility
export default AuthService;