import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthService } from '../services/auth';
import { AuthError, JWTPayload } from '../types';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export class AuthMiddleware {
  private static authService = AuthService.getInstance();

  /**
   * Middleware to authenticate JWT tokens
   */
  public static authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'Authorization header required',
          code: 'MISSING_AUTH_HEADER'
        });
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        res.status(401).json({
          success: false,
          error: 'Invalid authorization header format. Use: Bearer <token>',
          code: 'INVALID_AUTH_FORMAT'
        });
        return;
      }

      const token = parts[1];
      
      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Access token required',
          code: 'MISSING_TOKEN'
        });
        return;
      }

      // Verify token
      const payload = AuthMiddleware.authService.verifyToken(token);
      req.user = payload;
      
      // Check if token is near expiry and include warning header
      if (AuthMiddleware.authService.isTokenNearExpiry(token, 24)) {
        res.setHeader('X-Token-Near-Expiry', 'true');
        res.setHeader('X-Token-Expires-At', AuthMiddleware.authService.getTokenExpiration(token)?.toISOString() || '');
      }

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.code
        });
      } else {
        res.status(401).json({
          success: false,
          error: 'Authentication failed',
          code: 'AUTH_FAILED'
        });
      }
    }
  };

  /**
   * Middleware to authorize users based on plan type
   */
  public static authorizePlan = (allowedPlans: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!allowedPlans.includes(req.user.planType)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient plan privileges',
          code: 'INSUFFICIENT_PLAN',
          data: {
            requiredPlans: allowedPlans,
            currentPlan: req.user.planType
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to ensure user owns the resource
   */
  public static authorizeUser = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    // Check if the user is accessing their own resource
    const resourceUserId = req.params.userId || req.params.id;
    if (resourceUserId && resourceUserId !== req.user.userId) {
      res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.',
        code: 'ACCESS_DENIED'
      });
      return;
    }

    next();
  };

  /**
   * Optional authentication middleware (doesn't fail if no token)
   */
  public static optionalAuth = async (
    req: Request,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        next();
        return;
      }

      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        next();
        return;
      }

      const token = parts[1];
      
      if (token) {
        try {
          const payload = AuthMiddleware.authService.verifyToken(token);
          req.user = payload;
        } catch {
          // Ignore token validation errors for optional auth
        }
      }

      next();
    } catch {
      // Ignore all errors for optional auth
      next();
    }
  };

  /**
   * Rate limiting for login attempts
   */
  public static loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: {
      success: false,
      error: 'Too many login attempts, please try again later',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: true, // Don't count successful requests
    keyGenerator: (req: Request) => {
      // Use combination of IP and email for more precise rate limiting
      const email = req.body?.email || 'unknown';
      return `${req.ip || 'unknown-ip'}-${email}`;
    }
  });

  /**
   * Rate limiting for registration attempts
   */
  public static registerRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each IP to 3 registrations per hour
    message: {
      success: false,
      error: 'Too many registration attempts, please try again later',
      code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.ip || 'unknown-ip'
  });

  /**
   * General API rate limiting
   */
  public static apiRateLimit = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests, please try again later',
      code: 'API_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      // Use user ID if authenticated, otherwise use IP
      return req.user?.userId || req.ip || 'unknown-ip';
    },
    skip: (req: Request) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    }
  });

  /**
   * Strict rate limiting for password change attempts
   */
  public static passwordChangeRateLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // limit each user to 3 password changes per hour
    message: {
      success: false,
      error: 'Too many password change attempts, please try again later',
      code: 'PASSWORD_CHANGE_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => {
      return req.user?.userId || req.ip || 'unknown-ip';
    }
  });

  /**
   * Account deletion rate limiting
   */
  public static accountDeletionRateLimit = rateLimit({
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 1, // limit each IP to 1 account deletion per day
    message: {
      success: false,
      error: 'Account deletion limit exceeded, please contact support',
      code: 'ACCOUNT_DELETION_RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => req.ip || 'unknown-ip'
  });

  /**
   * Validate request body contains required fields
   */
  public static validateRequiredFields = (fields: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      const missingFields: string[] = [];
      
      for (const field of fields) {
        if (!req.body[field]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`,
          code: 'MISSING_REQUIRED_FIELDS',
          data: { missingFields }
        });
        return;
      }

      next();
    };
  };

  /**
   * Sanitize request body to prevent common attacks
   */
  public static sanitizeInput = (req: Request, _res: Response, next: NextFunction): void => {
    if (req.body) {
      // Remove potential XSS scripts and normalize whitespace
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Basic XSS prevention
          req.body[key] = req.body[key]
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
            .replace(/on\w+\s*=\s*'[^']*'/gi, '')
            .trim();
        }
      });
    }
    next();
  };

  /**
   * Extract user ID from authenticated request
   */
  public static getUserId = (req: Request): string => {
    if (!req.user) {
      throw new AuthError('User not authenticated', 401, 'NOT_AUTHENTICATED');
    }
    return req.user.userId;
  };

  /**
   * Extract user email from authenticated request
   */
  public static getUserEmail = (req: Request): string => {
    if (!req.user) {
      throw new AuthError('User not authenticated', 401, 'NOT_AUTHENTICATED');
    }
    return req.user.email;
  };

  /**
   * Check if user has specific plan type
   */
  public static hasMinimumPlan = (req: Request, minPlan: string): boolean => {
    if (!req.user) return false;
    
    const planHierarchy = ['free', 'personal', 'team'];
    const userPlanIndex = planHierarchy.indexOf(req.user.planType);
    const minPlanIndex = planHierarchy.indexOf(minPlan);
    
    return userPlanIndex >= minPlanIndex;
  };
}