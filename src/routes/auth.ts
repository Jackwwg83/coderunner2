import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth';
import { AuthMiddleware } from '../middleware/auth';
import { 
  AuthError, 
  LoginCredentials, 
  RegisterInput, 
  PasswordChangeRequest,
  ApiResponse 
} from '../types';

const router = Router();
const authService = AuthService.getInstance();

// Apply general rate limiting to all auth routes
router.use(AuthMiddleware.apiRateLimit);

// Apply input sanitization to all routes
router.use(AuthMiddleware.sanitizeInput);

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register',
  AuthMiddleware.registerRateLimit,
  AuthMiddleware.validateRequiredFields(['email', 'password']),
  async (req: Request, res: Response) => {
    try {
      const registerData: RegisterInput = {
        email: req.body.email,
        password: req.body.password,
        planType: req.body.planType || 'free'
      };

      const result = await authService.register(registerData);
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * POST /api/auth/login
 * User login
 */
router.post('/login',
  AuthMiddleware.loginRateLimit,
  AuthMiddleware.validateRequiredFields(['email', 'password']),
  async (req: Request, res: Response) => {
    try {
      const credentials: LoginCredentials = {
        email: req.body.email,
        password: req.body.password
      };

      const result = await authService.login(credentials);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Login error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * POST /api/auth/refresh
 * Refresh JWT token
 */
router.post('/refresh',
  AuthMiddleware.validateRequiredFields(['token']),
  async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      const result = await authService.refreshToken(token);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Token refresh error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * GET /api/auth/me
 * Get current user information
 */
router.get('/me',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization!;
      const token = authHeader.split(' ')[1];
      
      const user = await authService.getCurrentUser(token);
      
      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'User information retrieved successfully',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Get user error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const userId = AuthMiddleware.getUserId(req);
      const updates = {
        email: req.body.email,
        plan_type: req.body.plan_type
      };

      // Remove undefined fields
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof typeof updates] === undefined) {
          delete updates[key as keyof typeof updates];
        }
      });

      if (Object.keys(updates).length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update',
          code: 'NO_UPDATES_PROVIDED',
          timestamp: new Date()
        });
        return;
      }

      const user = await authService.updateProfile(userId, updates);
      
      const response: ApiResponse = {
        success: true,
        data: user,
        message: 'Profile updated successfully',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Profile update error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * PUT /api/auth/password
 * Change user password
 */
router.put('/password',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.passwordChangeRateLimit,
  AuthMiddleware.validateRequiredFields(['oldPassword', 'newPassword']),
  async (req: Request, res: Response) => {
    try {
      const userId = AuthMiddleware.getUserId(req);
      const passwordRequest: PasswordChangeRequest = {
        oldPassword: req.body.oldPassword,
        newPassword: req.body.newPassword
      };

      const result = await authService.changePassword(userId, passwordRequest);
      
      // Optionally revoke current token to force re-authentication
      const authHeader = req.headers.authorization!;
      const currentToken = authHeader.split(' ')[1];
      authService.revokeToken(currentToken);
      
      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Password changed successfully. Please log in again.',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Password change error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * POST /api/auth/logout
 * Logout user (revoke token)
 */
router.post('/logout',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization!;
      const token = authHeader.split(' ')[1];
      
      authService.revokeToken(token);
      
      const response: ApiResponse = {
        success: true,
        message: 'Logout successful',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date()
      });
    }
  }
);

/**
 * DELETE /api/auth/account
 * Delete user account (requires password confirmation)
 */
router.delete('/account',
  AuthMiddleware.authenticateToken,
  AuthMiddleware.accountDeletionRateLimit,
  AuthMiddleware.validateRequiredFields(['password']),
  async (req: Request, res: Response) => {
    try {
      const userId = AuthMiddleware.getUserId(req);
      const { password } = req.body;

      const result = await authService.deleteAccount(userId, password);
      
      // Revoke current token
      const authHeader = req.headers.authorization!;
      const currentToken = authHeader.split(' ')[1];
      authService.revokeToken(currentToken);
      
      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Account deleted successfully',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code,
          timestamp: new Date()
        });
      } else {
        console.error('Account deletion error:', error);
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          code: 'INTERNAL_SERVER_ERROR',
          timestamp: new Date()
        });
      }
    }
  }
);

/**
 * POST /api/auth/validate-password
 * Validate password strength (utility endpoint)
 */
router.post('/validate-password',
  AuthMiddleware.validateRequiredFields(['password']),
  async (req: Request, res: Response) => {
    try {
      const { password } = req.body;
      const validation = authService.validatePassword(password);
      
      const response: ApiResponse = {
        success: true,
        data: validation,
        message: 'Password validation complete',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Password validation error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date()
      });
    }
  }
);

/**
 * GET /api/auth/token-info
 * Get token information (expiry, etc.)
 */
router.get('/token-info',
  AuthMiddleware.authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization!;
      const token = authHeader.split(' ')[1];
      
      const expiration = authService.getTokenExpiration(token);
      const isNearExpiry = authService.isTokenNearExpiry(token, 24);
      
      const response: ApiResponse = {
        success: true,
        data: {
          expiresAt: expiration,
          isNearExpiry,
          user: req.user
        },
        message: 'Token information retrieved successfully',
        timestamp: new Date()
      };
      
      res.status(200).json(response);
    } catch (error) {
      console.error('Token info error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
        timestamp: new Date()
      });
    }
  }
);

export default router;