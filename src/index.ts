import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import { DatabaseService } from './services/database';
import OAuthService from './services/oauth';
import routes from './routes/index';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Export app for testing
export { app };

// Security middleware - Enhanced protection
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
}));

// HTTP Parameter Pollution protection
app.use(hpp());

// NoSQL Injection protection
app.use(mongoSanitize());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8083',
  credentials: true
}));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware with enhanced security
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: ['application/json', 'application/*+json']
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100 // Prevent parameter pollution
}));

// Initialize Passport for OAuth
const oauthService = OAuthService.getInstance();
app.use(oauthService.getPassport().initialize());

// Additional input sanitization
app.use((req, res, next) => {
  // Basic XSS protection for string inputs
  const sanitizeString = (str: string) => {
    return str.replace(/<script[^>]*>.*?<\/script>/gi, '')
             .replace(/<[^>]*>/g, '')
             .replace(/javascript:/gi, '')
             .replace(/on\w+=/gi, '');
  };

  const sanitizeObject = (obj: any) => {
    if (typeof obj === 'string') {
      return sanitizeString(obj);
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          obj[key] = sanitizeObject(obj[key]);
        }
      }
    }
    return obj;
  };

  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) req.query = sanitizeObject(req.query);
  if (req.params) req.params = sanitizeObject(req.params);
  
  next();
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'CodeRunner API',
    version: '1.0.0'
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global error handler
app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', error);
  
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server
async function startServer() {
  try {
    // Try to initialize database connection
    if (process.env.DB_PASSWORD) {
      try {
        const dbService = DatabaseService.getInstance();
        await dbService.connect();
        console.log('✅ Database connected successfully');
      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
        console.warn('⚠️ Database connection failed (continuing without database):', errorMessage);
        console.log('💡 This is normal in development if PostgreSQL is not installed');
      }
    } else {
      console.log('ℹ️ Database password not configured, skipping database connection');
      console.log('💡 Set DB_PASSWORD in .env file when PostgreSQL is available');
    }

    // Start HTTP server
    app.listen(PORT, () => {
      console.log(`🚀 CodeRunner API server is running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📋 API documentation: http://localhost:${PORT}/api`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  try {
    const dbService = DatabaseService.getInstance();
    if (dbService.isConnected()) {
      await dbService.disconnect();
    }
  } catch (error) {
    console.warn('⚠️ Error during database disconnect:', error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  try {
    const dbService = DatabaseService.getInstance();
    if (dbService.isConnected()) {
      await dbService.disconnect();
    }
  } catch (error) {
    console.warn('⚠️ Error during database disconnect:', error instanceof Error ? error.message : 'Unknown error');
  }
  process.exit(0);
});

// Start the server only if this module is run directly
if (require.main === module) {
  startServer();
}