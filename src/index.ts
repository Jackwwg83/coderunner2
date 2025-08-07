import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { DatabaseService } from './services/database';
import routes from './routes/index';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Export app for testing
export { app };

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Logging middleware
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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