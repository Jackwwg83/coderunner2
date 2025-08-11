import { Request, Response, NextFunction } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import validator from 'validator';
import xss from 'xss';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

/**
 * Handle validation errors helper function
 */
function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg
    }));

    res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errorMessages
    });
    return;
  }

  next();
}

/**
 * Comprehensive input validation and sanitization middleware
 */
export class ValidationMiddleware {
  /**
   * Sanitize all string inputs to prevent XSS attacks
   */
  public static sanitizeInput = (req: Request, res: Response, next: NextFunction): void => {
    const sanitize = (obj: any): void => {
      if (!obj || typeof obj !== 'object') return;
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === 'string') {
            // XSS protection with comprehensive cleaning
            obj[key] = xss(obj[key], {
              whiteList: {}, // No HTML tags allowed
              stripIgnoreTag: true,
              stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed']
            });
            
            // Additional sanitization
            obj[key] = validator.escape(obj[key]);
            
            // Remove null bytes and control characters
            obj[key] = obj[key].replace(/[\x00-\x1F\x7F]/g, '');
            
            // Trim whitespace
            obj[key] = obj[key].trim();
          } else if (typeof obj[key] === 'object') {
            sanitize(obj[key]);
          }
        }
      }
    };

    // Sanitize all input sources
    if (req.body) sanitize(req.body);
    if (req.query) sanitize(req.query);
    if (req.params) sanitize(req.params);

    next();
  };

  /**
   * Validate and sanitize email input
   */
  public static validateEmail = [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
      .normalizeEmail()
      .isLength({ max: 254 })
      .withMessage('Email address too long'),
    handleValidationErrors
  ];

  /**
   * Validate password strength
   */
  public static validatePassword = [
    body('password')
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be between 8 and 128 characters')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character (@$!%*?&)')
      .custom((value) => {
        // Additional password strength checks
        const commonPasswords = [
          'password', '12345678', 'qwerty123', 'password123', 'admin123',
          'letmein123', '123456789', 'welcome123', 'changeme123'
        ];
        if (commonPasswords.includes(value.toLowerCase())) {
          throw new Error('Password is too common. Please choose a stronger password.');
        }
        return true;
      }),
    handleValidationErrors
  ];

  /**
   * Validate project name
   */
  public static validateProjectName = [
    body('name')
      .isLength({ min: 1, max: 100 })
      .withMessage('Project name must be between 1 and 100 characters')
      .matches(/^[a-zA-Z0-9\-_\s]+$/)
      .withMessage('Project name can only contain letters, numbers, hyphens, underscores, and spaces'),
    handleValidationErrors
  ];

  /**
   * Validate UUID parameters
   */
  public static validateUUID = (paramName: string) => [
    param(paramName)
      .isUUID()
      .withMessage(`${paramName} must be a valid UUID`),
    handleValidationErrors
  ];

  /**
   * Validate deployment configuration
   */
  public static validateDeploymentConfig = [
    body('runtime_type')
      .optional()
      .isIn(['node', 'python', 'go', 'java'])
      .withMessage('Runtime type must be one of: node, python, go, java'),
    body('environment')
      .optional()
      .isIn(['development', 'staging', 'production'])
      .withMessage('Environment must be one of: development, staging, production'),
    handleValidationErrors
  ];

  /**
   * SQL Injection protection for search queries
   */
  public static validateSearchQuery = [
    query('q')
      .optional()
      .isLength({ min: 1, max: 200 })
      .withMessage('Search query must be between 1 and 200 characters')
      .matches(/^[a-zA-Z0-9\s\-_\.]+$/)
      .withMessage('Search query contains invalid characters'),
    handleValidationErrors
  ];

  /**
   * Validate file upload content
   */
  public static validateFileContent = (req: Request, res: Response, next: NextFunction): void => {
    if (req.body && req.body.files) {
      try {
        const files = Array.isArray(req.body.files) ? req.body.files : [req.body.files];
        
        for (const file of files) {
          if (file && typeof file === 'object') {
            // Validate file path to prevent directory traversal
            if (file.path) {
              if (file.path.includes('..') || file.path.includes('~') || file.path.startsWith('/')) {
                res.status(400).json({
                  success: false,
                  error: 'Invalid file path detected',
                  code: 'INVALID_FILE_PATH'
                });
                return;
              }
            }

            // Validate file content size
            if (file.content && typeof file.content === 'string') {
              if (file.content.length > 1024 * 1024) { // 1MB limit
                res.status(400).json({
                  success: false,
                  error: 'File content too large (max 1MB)',
                  code: 'FILE_TOO_LARGE'
                });
                return;
              }

              // Basic XSS protection in file content
              file.content = xss(file.content, {
                whiteList: {
                  pre: [],
                  code: [],
                  span: ['class'],
                  div: ['class']
                }
              });
            }
          }
        }
      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid file data format',
          code: 'INVALID_FILE_FORMAT'
        });
        return;
      }
    }

    next();
  };


  /**
   * Apply MongoDB sanitization
   */
  public static applyMongoSanitize = mongoSanitize({
    replaceWith: '_',
    allowDots: false,
    dryRun: false
  });

  /**
   * Apply HTTP Parameter Pollution protection
   */
  public static applyHPPProtection = hpp({
    whitelist: ['tags', 'filter', 'sort'] // Allow arrays for these parameters
  });

  /**
   * Advanced SQL injection prevention
   */
  public static preventSQLInjection = (req: Request, res: Response, next: NextFunction): void => {
    const checkForSQLInjection = (value: string): boolean => {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION)\b)/i,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
        /(--|#|\/\*|\*\/|\bxp_\b)/i,
        /(\b(SCRIPT|JAVASCRIPT|VBSCRIPT|ONLOAD|ONERROR|ONCLICK)\b)/i,
        /('|(\\')|('')|(%27)|(%2527))/i,
        /(;|\||`|&|sp_\b)/i,
        /(\bCAST\b|\bCONVERT\b|\bCHAR\b|\bCHR\b)/i,
        /(\bWAITFOR\b|\bDELAY\b|\bSLEEP\b)/i
      ];

      return sqlPatterns.some(pattern => pattern.test(value));
    };

    const checkObject = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return checkForSQLInjection(obj);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (checkObject(obj[key])) {
              return true;
            }
          }
        }
      }
      
      return false;
    };

    // Check all input sources for SQL injection patterns
    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
      res.status(400).json({
        success: false,
        error: 'Potentially malicious input detected',
        code: 'SECURITY_VIOLATION'
      });
      return;
    }

    next();
  };

  /**
   * Command injection prevention
   */
  public static preventCommandInjection = (req: Request, res: Response, next: NextFunction): void => {
    const checkForCommandInjection = (value: string): boolean => {
      const commandPatterns = [
        /(;|\||&|\$\(|`|\$\{)/,
        /(\b(rm|ls|cat|grep|find|ps|kill|sudo|chmod|chown|wget|curl)\b)/i,
        /(\.\.|\/etc|\/bin|\/usr|\/var|\/tmp)/i,
        /(<|>|>>|\/dev\/null)/,
        /(\beval\b|\bexec\b|\bsystem\b|\bshell_exec\b)/i
      ];

      return commandPatterns.some(pattern => pattern.test(value));
    };

    const checkObject = (obj: any): boolean => {
      if (typeof obj === 'string') {
        return checkForCommandInjection(obj);
      }
      
      if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
          if (obj.hasOwnProperty(key)) {
            if (checkObject(obj[key])) {
              return true;
            }
          }
        }
      }
      
      return false;
    };

    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
      res.status(400).json({
        success: false,
        error: 'Potentially malicious command injection detected',
        code: 'COMMAND_INJECTION_BLOCKED'
      });
      return;
    }

    next();
  };

  /**
   * Rate limiting validation for sensitive operations
   */
  public static validateSensitiveOperation = (req: Request, res: Response, next: NextFunction): void => {
    // Additional validation for sensitive operations like password changes, account deletion
    const userAgent = req.get('User-Agent') || '';
    const xForwardedFor = req.get('X-Forwarded-For');
    const clientIP = req.ip;

    // Block suspicious user agents (but allow legitimate testing tools in dev)
    const suspiciousPatterns = [
      /sqlmap/i, /nikto/i, /nessus/i, /openvas/i, /nmap/i,
      /masscan/i, /zap/i, /burp/i, /acunetix/i, /w3af/i
    ];

    if (process.env.NODE_ENV === 'production' && suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
      res.status(403).json({
        success: false,
        error: 'Access denied for security scanning tools',
        code: 'SECURITY_SCANNER_BLOCKED'
      });
      return;
    }

    // Log suspicious activity
    if (xForwardedFor || clientIP === '127.0.0.1') {
      console.warn(`Sensitive operation from suspicious source: IP=${clientIP}, XFF=${xForwardedFor}, UA=${userAgent}`);
    }

    next();
  };
}

// Export individual middleware functions for convenience
export const sanitizeInput = ValidationMiddleware.sanitizeInput;
export const validateEmail = ValidationMiddleware.validateEmail;
export const validatePassword = ValidationMiddleware.validatePassword;
export const validateProjectName = ValidationMiddleware.validateProjectName;
export const validateUUID = ValidationMiddleware.validateUUID;
export const validateDeploymentConfig = ValidationMiddleware.validateDeploymentConfig;
export const validateSearchQuery = ValidationMiddleware.validateSearchQuery;
export const validateFileContent = ValidationMiddleware.validateFileContent;
export const preventSQLInjection = ValidationMiddleware.preventSQLInjection;
export const preventCommandInjection = ValidationMiddleware.preventCommandInjection;
export const validateSensitiveOperation = ValidationMiddleware.validateSensitiveOperation;
export const applyMongoSanitize = ValidationMiddleware.applyMongoSanitize;
export const applyHPPProtection = ValidationMiddleware.applyHPPProtection;
export const validateRequest = ValidationMiddleware.sanitizeInput;