import { Request, Response, NextFunction } from 'express';
import { JWTPayload } from '../types';

/**
 * Role-Based Access Control (RBAC) Middleware
 */
export class RBACMiddleware {
  // Define role hierarchy (higher index = more permissions)
  private static readonly ROLE_HIERARCHY = ['free', 'personal', 'team', 'admin'];
  
  // Define permissions for each role
  private static readonly ROLE_PERMISSIONS = {
    free: [
      'project:create',
      'project:read:own',
      'project:update:own',
      'project:delete:own',
      'deployment:create:basic',
      'profile:read:own',
      'profile:update:own'
    ],
    personal: [
      'project:create',
      'project:read:own',
      'project:update:own',
      'project:delete:own',
      'deployment:create',
      'deployment:read:own',
      'deployment:update:own',
      'deployment:delete:own',
      'profile:read:own',
      'profile:update:own',
      'analytics:read:own'
    ],
    team: [
      'project:create',
      'project:read:own',
      'project:read:team',
      'project:update:own',
      'project:update:team',
      'project:delete:own',
      'project:delete:team',
      'deployment:create',
      'deployment:read:own',
      'deployment:read:team',
      'deployment:update:own',
      'deployment:update:team',
      'deployment:delete:own',
      'deployment:delete:team',
      'profile:read:own',
      'profile:update:own',
      'team:manage',
      'analytics:read:own',
      'analytics:read:team'
    ],
    admin: [
      'project:create',
      'project:read',
      'project:update',
      'project:delete',
      'deployment:create',
      'deployment:read',
      'deployment:update',
      'deployment:delete',
      'user:read',
      'user:update',
      'user:delete',
      'profile:read',
      'profile:update',
      'analytics:read',
      'system:manage'
    ]
  };

  /**
   * Require specific role or higher
   */
  public static requireRole = (requiredRole: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const userRole = req.user.planType;
      const hasRequiredRole = RBACMiddleware.hasRoleOrHigher(userRole, requiredRole);

      if (!hasRequiredRole) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          data: {
            required: requiredRole,
            current: userRole,
            message: `This operation requires ${requiredRole} plan or higher`
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Require specific permission
   */
  public static requirePermission = (permission: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const userRole = req.user.planType;
      const hasPermission = RBACMiddleware.hasPermission(userRole, permission);

      if (!hasPermission) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          data: {
            required: permission,
            current: userRole,
            message: `This operation requires permission: ${permission}`
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Require multiple permissions (all must be present)
   */
  public static requirePermissions = (permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const userRole = req.user.planType;
      const missingPermissions = permissions.filter(
        permission => !RBACMiddleware.hasPermission(userRole, permission)
      );

      if (missingPermissions.length > 0) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          data: {
            required: permissions,
            missing: missingPermissions,
            current: userRole,
            message: `Missing required permissions: ${missingPermissions.join(', ')}`
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Require any of the specified permissions (at least one must be present)
   */
  public static requireAnyPermission = (permissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const userRole = req.user.planType;
      const hasAnyPermission = permissions.some(
        permission => RBACMiddleware.hasPermission(userRole, permission)
      );

      if (!hasAnyPermission) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          data: {
            required: permissions,
            current: userRole,
            message: `This operation requires at least one of: ${permissions.join(', ')}`
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Ensure user can only access their own resources
   */
  public static requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const resourceUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
      
      if (!resourceUserId) {
        res.status(400).json({
          success: false,
          error: 'User ID parameter is required',
          code: 'MISSING_USER_ID'
        });
        return;
      }

      // Admin can access any resource
      if (req.user.planType === 'admin') {
        next();
        return;
      }

      // Check if user owns the resource
      if (resourceUserId !== req.user.userId) {
        res.status(403).json({
          success: false,
          error: 'Access denied. You can only access your own resources.',
          code: 'ACCESS_DENIED',
          data: {
            resourceUserId,
            currentUserId: req.user.userId
          }
        });
        return;
      }

      next();
    };
  };

  /**
   * Admin-only access
   */
  public static requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    if (req.user.planType !== 'admin') {
      res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED',
        data: {
          current: req.user.planType,
          message: 'This operation requires admin privileges'
        }
      });
      return;
    }

    next();
  };

  /**
   * Team access control (team members can access team resources)
   */
  public static requireTeamAccess = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'NOT_AUTHENTICATED'
      });
      return;
    }

    const userRole = req.user.planType;
    
    // Admin has access to all team resources
    if (userRole === 'admin') {
      next();
      return;
    }

    // Team and higher plans have team access
    if (RBACMiddleware.hasRoleOrHigher(userRole, 'team')) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Team access required',
      code: 'TEAM_ACCESS_REQUIRED',
      data: {
        current: userRole,
        message: 'This operation requires team plan or higher'
      }
    });
  };

  /**
   * Conditional access based on resource type and ownership
   */
  public static conditionalAccess = (options: {
    ownershipParam?: string;
    allowedRoles?: string[];
    requiredPermission?: string;
  }) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      const userRole = req.user.planType;
      
      // Admin always has access
      if (userRole === 'admin') {
        next();
        return;
      }

      // Check role-based access
      if (options.allowedRoles && !options.allowedRoles.includes(userRole)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient role',
          code: 'INSUFFICIENT_ROLE',
          data: {
            required: options.allowedRoles,
            current: userRole
          }
        });
        return;
      }

      // Check permission-based access
      if (options.requiredPermission && !RBACMiddleware.hasPermission(userRole, options.requiredPermission)) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSION',
          data: {
            required: options.requiredPermission,
            current: userRole
          }
        });
        return;
      }

      // Check ownership if specified
      if (options.ownershipParam) {
        const resourceUserId = req.params[options.ownershipParam] || 
                             req.body[options.ownershipParam] || 
                             req.query[options.ownershipParam];
        
        if (resourceUserId && resourceUserId !== req.user.userId) {
          res.status(403).json({
            success: false,
            error: 'Access denied. You can only access your own resources.',
            code: 'ACCESS_DENIED'
          });
          return;
        }
      }

      next();
    };
  };

  // Helper methods
  
  /**
   * Check if user has specific role or higher in hierarchy
   */
  private static hasRoleOrHigher(userRole: string, requiredRole: string): boolean {
    const userIndex = RBACMiddleware.ROLE_HIERARCHY.indexOf(userRole);
    const requiredIndex = RBACMiddleware.ROLE_HIERARCHY.indexOf(requiredRole);
    
    return userIndex !== -1 && requiredIndex !== -1 && userIndex >= requiredIndex;
  }

  /**
   * Check if user has specific permission
   */
  private static hasPermission(userRole: string, permission: string): boolean {
    const permissions = RBACMiddleware.ROLE_PERMISSIONS[userRole as keyof typeof RBACMiddleware.ROLE_PERMISSIONS];
    return permissions ? permissions.includes(permission) : false;
  }

  /**
   * Get all permissions for a role
   */
  public static getRolePermissions(role: string): string[] {
    return RBACMiddleware.ROLE_PERMISSIONS[role as keyof typeof RBACMiddleware.ROLE_PERMISSIONS] || [];
  }

  /**
   * Check if user can perform action on resource
   */
  public static canAccess(userRole: string, resource: string, action: string, isOwner: boolean = false): boolean {
    const permission = `${resource}:${action}`;
    const ownerPermission = `${resource}:${action}:own`;
    
    return RBACMiddleware.hasPermission(userRole, permission) || 
           (isOwner && RBACMiddleware.hasPermission(userRole, ownerPermission));
  }
}

// Export commonly used middleware functions
export const requireRole = RBACMiddleware.requireRole;
export const requirePermission = RBACMiddleware.requirePermission;
export const requirePermissions = RBACMiddleware.requirePermissions;
export const requireAnyPermission = RBACMiddleware.requireAnyPermission;
export const requireOwnership = RBACMiddleware.requireOwnership;
export const requireAdmin = RBACMiddleware.requireAdmin;
export const requireTeamAccess = RBACMiddleware.requireTeamAccess;
export const conditionalAccess = RBACMiddleware.conditionalAccess;
export const rbacMiddleware = RBACMiddleware.requirePermission;