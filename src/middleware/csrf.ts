import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Note: Using custom implementation since csurf is deprecated
 */
export class CSRFMiddleware {
  private static readonly TOKEN_SECRET = process.env.CSRF_SECRET || 'csrf-secret-key';
  private static readonly TOKEN_LENGTH = 32;

  /**
   * Generate CSRF token
   */
  private static generateToken(): string {
    return crypto.randomBytes(CSRFMiddleware.TOKEN_LENGTH).toString('hex');
  }

  /**
   * Generate signed CSRF token
   */
  private static generateSignedToken(token: string): string {
    const hmac = crypto.createHmac('sha256', CSRFMiddleware.TOKEN_SECRET);
    hmac.update(token);
    return token + '.' + hmac.digest('hex');
  }

  /**
   * Verify CSRF token signature
   */
  private static verifyTokenSignature(signedToken: string): boolean {
    try {
      const parts = signedToken.split('.');
      if (parts.length !== 2) return false;

      const [token, signature] = parts;
      const expectedSignature = crypto
        .createHmac('sha256', CSRFMiddleware.TOKEN_SECRET)
        .update(token)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Initialize CSRF protection
   */
  public static initialize = (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF for GET, HEAD, OPTIONS requests and API endpoints with Bearer tokens
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    const hasAuthToken = req.headers.authorization?.startsWith('Bearer ');
    const isApiEndpoint = req.path.startsWith('/api/');

    if (safeMethods.includes(req.method) || (hasAuthToken && isApiEndpoint)) {
      next();
      return;
    }

    // Initialize CSRF token in session
    if (!req.session) {
      res.status(500).json({
        success: false,
        error: 'Session middleware required for CSRF protection',
        code: 'SESSION_REQUIRED'
      });
      return;
    }

    if (!req.session.csrfToken) {
      const token = CSRFMiddleware.generateToken();
      req.session.csrfToken = CSRFMiddleware.generateSignedToken(token);
    }

    // Add CSRF token to response locals for template rendering
    res.locals.csrfToken = req.session.csrfToken;

    next();
  };

  /**
   * Verify CSRF token
   */
  public static verify = (req: Request, res: Response, next: NextFunction): void => {
    // Skip CSRF for GET, HEAD, OPTIONS requests and API endpoints with Bearer tokens
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    const hasAuthToken = req.headers.authorization?.startsWith('Bearer ');
    const isApiEndpoint = req.path.startsWith('/api/');

    if (safeMethods.includes(req.method) || (hasAuthToken && isApiEndpoint)) {
      next();
      return;
    }

    if (!req.session) {
      res.status(500).json({
        success: false,
        error: 'Session middleware required for CSRF protection',
        code: 'SESSION_REQUIRED'
      });
      return;
    }

    const sessionToken = req.session.csrfToken;
    if (!sessionToken) {
      res.status(403).json({
        success: false,
        error: 'CSRF token not initialized',
        code: 'CSRF_NOT_INITIALIZED'
      });
      return;
    }

    // Get token from various sources
    const clientToken = 
      req.body._csrf ||
      req.body.csrf ||
      req.query._csrf ||
      req.query.csrf ||
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'];

    if (!clientToken) {
      res.status(403).json({
        success: false,
        error: 'CSRF token required',
        code: 'CSRF_TOKEN_REQUIRED',
        details: 'Include CSRF token in request body, query string, or headers (x-csrf-token, x-xsrf-token)'
      });
      return;
    }

    // Verify token signature
    if (!CSRFMiddleware.verifyTokenSignature(sessionToken)) {
      res.status(403).json({
        success: false,
        error: 'Invalid session CSRF token',
        code: 'CSRF_SESSION_INVALID'
      });
      return;
    }

    if (!CSRFMiddleware.verifyTokenSignature(clientToken)) {
      res.status(403).json({
        success: false,
        error: 'Invalid client CSRF token',
        code: 'CSRF_CLIENT_INVALID'
      });
      return;
    }

    // Compare tokens using timing-safe comparison
    try {
      const sessionTokenBuffer = Buffer.from(sessionToken, 'hex');
      const clientTokenBuffer = Buffer.from(clientToken, 'hex');

      if (sessionTokenBuffer.length !== clientTokenBuffer.length) {
        res.status(403).json({
          success: false,
          error: 'CSRF token mismatch',
          code: 'CSRF_TOKEN_MISMATCH'
        });
        return;
      }

      if (!crypto.timingSafeEqual(sessionTokenBuffer, clientTokenBuffer)) {
        res.status(403).json({
          success: false,
          error: 'CSRF token mismatch',
          code: 'CSRF_TOKEN_MISMATCH'
        });
        return;
      }
    } catch (error) {
      res.status(403).json({
        success: false,
        error: 'CSRF token comparison failed',
        code: 'CSRF_COMPARISON_ERROR'
      });
      return;
    }

    next();
  };

  /**
   * Generate new CSRF token (for token rotation)
   */
  public static generateNewToken = (req: Request, res: Response, next: NextFunction): void => {
    if (req.session) {
      const token = CSRFMiddleware.generateToken();
      req.session.csrfToken = CSRFMiddleware.generateSignedToken(token);
      res.locals.csrfToken = req.session.csrfToken;
    }
    next();
  };

  /**
   * Get CSRF token endpoint
   */
  public static getToken = (req: Request, res: Response): void => {
    if (!req.session) {
      res.status(500).json({
        success: false,
        error: 'Session middleware required',
        code: 'SESSION_REQUIRED'
      });
      return;
    }

    if (!req.session.csrfToken) {
      const token = CSRFMiddleware.generateToken();
      req.session.csrfToken = CSRFMiddleware.generateSignedToken(token);
    }

    res.json({
      success: true,
      data: {
        csrfToken: req.session.csrfToken
      },
      message: 'CSRF token generated'
    });
  };

  /**
   * Double submit cookie pattern (alternative to session-based CSRF)
   */
  public static doubleSubmitCookie = {
    initialize: (req: Request, res: Response, next: NextFunction): void => {
      const token = CSRFMiddleware.generateToken();
      const signedToken = CSRFMiddleware.generateSignedToken(token);

      // Set CSRF token in cookie
      res.cookie('XSRF-TOKEN', signedToken, {
        httpOnly: false, // Allow JavaScript access for AJAX requests
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000 // 1 hour
      });

      next();
    },

    verify: (req: Request, res: Response, next: NextFunction): void => {
      const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
      if (safeMethods.includes(req.method)) {
        next();
        return;
      }

      const cookieToken = req.cookies['XSRF-TOKEN'];
      const headerToken = req.headers['x-xsrf-token'] || req.body._token;

      if (!cookieToken || !headerToken) {
        res.status(403).json({
          success: false,
          error: 'CSRF token required in both cookie and header/body',
          code: 'CSRF_DOUBLE_SUBMIT_REQUIRED'
        });
        return;
      }

      if (!CSRFMiddleware.verifyTokenSignature(cookieToken) || 
          !CSRFMiddleware.verifyTokenSignature(headerToken)) {
        res.status(403).json({
          success: false,
          error: 'Invalid CSRF token signature',
          code: 'CSRF_INVALID_SIGNATURE'
        });
        return;
      }

      try {
        const cookieBuffer = Buffer.from(cookieToken, 'hex');
        const headerBuffer = Buffer.from(headerToken, 'hex');

        if (!crypto.timingSafeEqual(cookieBuffer, headerBuffer)) {
          res.status(403).json({
            success: false,
            error: 'CSRF token mismatch',
            code: 'CSRF_TOKEN_MISMATCH'
          });
          return;
        }
      } catch (error) {
        res.status(403).json({
          success: false,
          error: 'CSRF token comparison failed',
          code: 'CSRF_COMPARISON_ERROR'
        });
        return;
      }

      next();
    }
  };

  /**
   * Origin/Referer validation (additional CSRF protection)
   */
  public static validateOrigin = (req: Request, res: Response, next: NextFunction): void => {
    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
      next();
      return;
    }

    const origin = req.get('Origin');
    const referer = req.get('Referer');
    const host = req.get('Host');

    const allowedOrigins = [
      `http://localhost:${process.env.PORT || 8080}`,
      `https://localhost:${process.env.PORT || 8080}`,
      process.env.ALLOWED_ORIGIN
    ].filter(Boolean);

    // Check Origin header first
    if (origin) {
      if (!allowedOrigins.includes(origin)) {
        res.status(403).json({
          success: false,
          error: 'Invalid origin',
          code: 'INVALID_ORIGIN'
        });
        return;
      }
    } else if (referer) {
      // Fallback to Referer header
      const refererHost = new URL(referer).host;
      if (refererHost !== host) {
        res.status(403).json({
          success: false,
          error: 'Invalid referer',
          code: 'INVALID_REFERER'
        });
        return;
      }
    } else {
      // Neither Origin nor Referer present
      res.status(403).json({
        success: false,
        error: 'Missing origin or referer header',
        code: 'MISSING_ORIGIN_REFERER'
      });
      return;
    }

    next();
  };
}

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    csrfToken?: string;
  }
}

// Export middleware functions
export const initializeCSRF = CSRFMiddleware.initialize;
export const verifyCSRF = CSRFMiddleware.verify;
export const generateNewCSRFToken = CSRFMiddleware.generateNewToken;
export const getCSRFToken = CSRFMiddleware.getToken;
export const doubleSubmitCSRF = CSRFMiddleware.doubleSubmitCookie;
export const validateOrigin = CSRFMiddleware.validateOrigin;