import { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import session from 'express-session';
import rateLimit from 'express-rate-limit';

/**
 * Security Headers and Protection Middleware
 */
export class SecurityMiddleware {
  /**
   * Comprehensive security headers using Helmet
   */
  public static securityHeaders = helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "ws:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        childSrc: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        upgradeInsecureRequests: []
      },
      reportOnly: process.env.NODE_ENV === 'development'
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-XSS-Protection
    xssFilter: true,

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,

    // X-Download-Options
    ieNoOpen: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // Note: Expect-CT is deprecated and removed from helmet
    // Modern browsers use Certificate Transparency by default
  });

  /**
   * Session configuration with security best practices
   */
  public static sessionConfig = session({
    name: 'sessionId', // Don't use default session name
    secret: process.env.SESSION_SECRET || 'fallback-session-secret',
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on each request
    cookie: {
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      httpOnly: true, // Prevent XSS access to cookies
      maxAge: 30 * 60 * 1000, // 30 minutes
      sameSite: 'strict' // CSRF protection
    },
    genid: () => {
      // Generate secure session IDs
      return require('crypto').randomBytes(32).toString('hex');
    }
  });

  /**
   * Additional security headers
   */
  public static additionalHeaders = (req: Request, res: Response, next: NextFunction): void => {
    // Remove server information
    res.removeHeader('X-Powered-By');

    // Add custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Add custom headers for API identification (without revealing implementation)
    res.setHeader('X-API-Version', '2.0');
    res.setHeader('X-Rate-Limit-Policy', 'enforced');

    next();
  };

  /**
   * Request size limits
   */
  public static requestLimits = (req: Request, res: Response, next: NextFunction): void => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (req.headers['content-length']) {
      const contentLength = parseInt(req.headers['content-length']);
      if (contentLength > maxSize) {
        res.status(413).json({
          success: false,
          error: 'Request entity too large',
          code: 'PAYLOAD_TOO_LARGE',
          maxSize: '10MB'
        });
        return;
      }
    }

    next();
  };

  /**
   * IP-based access control
   */
  public static ipAccessControl = (req: Request, res: Response, next: NextFunction): void => {
    const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
    const forwardedFor = req.get('X-Forwarded-For');
    
    // Log suspicious IP patterns
    const suspiciousIPs = ['127.0.0.1', '::1', 'localhost'];
    
    if (process.env.NODE_ENV === 'production') {
      if (suspiciousIPs.some(ip => clientIp.includes(ip))) {
        console.warn(`Suspicious IP access in production: ${clientIp}, X-Forwarded-For: ${forwardedFor}`);
      }
    }

    // Add IP information to request for logging
    req.clientInfo = {
      ip: clientIp,
      forwardedFor: forwardedFor || null,
      userAgent: req.get('User-Agent') || 'unknown'
    };

    next();
  };

  /**
   * Session timeout and invalidation
   */
  public static sessionTimeout = (req: Request, res: Response, next: NextFunction): void => {
    if (req.session) {
      const now = Date.now();
      const lastAccess = req.session.lastAccess || now;
      const timeout = 30 * 60 * 1000; // 30 minutes

      if (now - lastAccess > timeout) {
        req.session.destroy((err) => {
          if (err) {
            console.error('Session destruction error:', err);
          }
        });
        
        res.status(401).json({
          success: false,
          error: 'Session expired',
          code: 'SESSION_EXPIRED'
        });
        return;
      }

      // Update last access time
      req.session.lastAccess = now;
    }

    next();
  };

  /**
   * Prevent HTTP Parameter Pollution
   */
  public static preventHPP = (req: Request, res: Response, next: NextFunction): void => {
    const checkForArrays = (obj: any): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (Array.isArray(obj[key])) {
            // Keep only the last value to prevent HPP
            obj[key] = obj[key][obj[key].length - 1];
          } else if (typeof obj[key] === 'object') {
            checkForArrays(obj[key]);
          }
        }
      }
    };

    if (req.query) checkForArrays(req.query);
    if (req.body) checkForArrays(req.body);

    next();
  };

  /**
   * Content-Type validation
   */
  public static validateContentType = (req: Request, res: Response, next: NextFunction): void => {
    const method = req.method.toLowerCase();
    
    if (['post', 'put', 'patch'].includes(method)) {
      const contentType = req.get('Content-Type') || '';
      const allowedTypes = [
        'application/json',
        'application/x-www-form-urlencoded',
        'multipart/form-data',
        'text/plain'
      ];

      if (!allowedTypes.some(type => contentType.includes(type))) {
        res.status(415).json({
          success: false,
          error: 'Unsupported media type',
          code: 'UNSUPPORTED_MEDIA_TYPE',
          allowedTypes
        });
        return;
      }
    }

    next();
  };

  /**
   * Request method validation
   */
  public static validateMethods = (req: Request, res: Response, next: NextFunction): void => {
    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];
    
    if (!allowedMethods.includes(req.method)) {
      res.status(405).json({
        success: false,
        error: 'Method not allowed',
        code: 'METHOD_NOT_ALLOWED',
        allowedMethods
      });
      return;
    }

    next();
  };

  /**
   * Security event logging
   */
  public static securityLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const clientInfo = (req as any).clientInfo || {};
      
      // Log security-relevant events
      if (res.statusCode >= 400) {
        console.warn(`Security Event: ${req.method} ${req.path}`, {
          status: res.statusCode,
          ip: clientInfo.ip,
          userAgent: clientInfo.userAgent,
          duration,
          timestamp: new Date().toISOString()
        });
      }

      // Log successful authentication events
      if (req.path.includes('/auth/') && res.statusCode === 200) {
        console.info(`Auth Success: ${req.method} ${req.path}`, {
          ip: clientInfo.ip,
          timestamp: new Date().toISOString()
        });
      }
    });

    next();
  };

  /**
   * Global rate limiter for general API requests
   */
  public static apiRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: {
      success: false,
      error: 'Too many requests from this IP, please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/ready' || req.path === '/live';
    }
  });

  /**
   * Strict rate limiter for authentication endpoints
   */
  public static authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 auth requests per windowMs
    message: {
      success: false,
      error: 'Too many authentication attempts, please try again later',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false
  });

  /**
   * Very strict rate limiter for login attempts
   */
  public static loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 login attempts per windowMs
    message: {
      success: false,
      error: 'Too many login attempts, please try again later',
      code: 'LOGIN_RATE_LIMIT_EXCEEDED',
      retryAfter: '15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Don't count successful requests
  });

  /**
   * Error information sanitization (prevent info leakage)
   */
  public static sanitizeErrors = (error: any, req: Request, res: Response, next: NextFunction): void => {
    // In production, don't expose internal error details
    if (process.env.NODE_ENV === 'production') {
      const safeErrors: { [key: number]: string } = {
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        405: 'Method Not Allowed',
        409: 'Conflict',
        413: 'Payload Too Large',
        415: 'Unsupported Media Type',
        422: 'Unprocessable Entity',
        429: 'Too Many Requests',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
      };

      const statusCode = error.statusCode || error.status || 500;
      const message = safeErrors[statusCode] || 'An error occurred';

      // Log full error details server-side for debugging
      console.error('Production Error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(statusCode).json({
        success: false,
        error: message,
        code: error.code || 'INTERNAL_ERROR'
      });
    } else {
      // In development, show full error details
      next(error);
    }
  };
}

// Session timeout handler
declare global {
  namespace Express {
    interface Request {
      clientInfo?: {
        ip: string;
        forwardedFor: string | null;
        userAgent: string;
      };
    }
  }
}

declare module 'express-session' {
  interface SessionData {
    lastAccess?: number;
  }
}

// Export middleware functions
export const securityHeaders = SecurityMiddleware.securityHeaders;
export const sessionConfig = SecurityMiddleware.sessionConfig;
export const additionalHeaders = SecurityMiddleware.additionalHeaders;
export const requestLimits = SecurityMiddleware.requestLimits;
export const ipAccessControl = SecurityMiddleware.ipAccessControl;
export const sessionTimeout = SecurityMiddleware.sessionTimeout;
export const preventHPP = SecurityMiddleware.preventHPP;
export const validateContentType = SecurityMiddleware.validateContentType;
export const validateMethods = SecurityMiddleware.validateMethods;
export const securityLogger = SecurityMiddleware.securityLogger;
export const sanitizeErrors = SecurityMiddleware.sanitizeErrors;
export const apiRateLimit = SecurityMiddleware.apiRateLimit;
export const authRateLimit = SecurityMiddleware.authRateLimit;
export const loginRateLimit = SecurityMiddleware.loginRateLimit;
export const rateLimiter = SecurityMiddleware.apiRateLimit;