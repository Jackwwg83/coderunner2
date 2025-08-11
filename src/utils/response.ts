/**
 * Standardized API Response Utilities
 * 
 * Provides consistent response formatting across all API endpoints
 * to ensure compatibility with frontend and test expectations.
 */

export interface StandardApiResponse {
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  code?: string;
  timestamp: string;
}

export class ApiResponse {
  /**
   * Create a successful response
   */
  static success(data: any, message?: string): StandardApiResponse {
    return {
      success: true,
      data,
      message: message || 'Operation successful',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create an error response
   */
  static error(error: string, code?: string, status?: number): StandardApiResponse {
    return {
      success: false,
      error,
      code: code || 'ERROR',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a health check response
   */
  static health(status: string, data: any): StandardApiResponse {
    return {
      success: status === 'ok' || status === 'healthy',
      data: {
        status,
        ...data
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a deployment list response
   */
  static deployments(deployments: any[]): StandardApiResponse {
    return {
      success: true,
      data: {
        deployments
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a policies list response
   */
  static policies(policies: any[]): StandardApiResponse {
    return {
      success: true,
      data: {
        policies
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create a services list response
   */
  static services(services: any[]): StandardApiResponse {
    return {
      success: true,
      data: {
        services
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Wrap existing auth service responses to ensure compatibility
   */
  static wrapAuthResponse(authResult: any): StandardApiResponse {
    if (authResult.success && authResult.data) {
      // Auth service already returns the correct format
      return {
        ...authResult,
        timestamp: authResult.timestamp || new Date().toISOString()
      };
    }
    
    // Handle legacy responses
    return {
      success: true,
      data: authResult,
      timestamp: new Date().toISOString()
    };
  }
}

// Legacy aliases for backward compatibility
export const respondWithError = ApiResponse.error;
export const respondWithSuccess = ApiResponse.success;