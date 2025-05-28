import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import path from 'path';

import { DatabaseService } from './services/DatabaseService';
import { XService } from './services/XService';
import { AIService } from './services/AIService';
import { NotificationService } from './services/NotificationService';
import { EngagementService } from './services/EngagementService';
import { AuthService } from './services/AuthService';

import notificationRoutes, { setNotificationService } from './routes/notifications';
import engagementRoutes, { setEngagementService } from './routes/engagement';
import postIdeasRoutes, { setServices } from './routes/postIdeas';
import settingsRoutes, { setDatabaseService } from './routes/settings';
import authRoutes, { setAuthService } from './routes/auth';

// Load environment variables
dotenv.config();

class XNOMApp {
  private app: express.Application;
  private server: any;
  private wss: WebSocketServer;
  private databaseService!: DatabaseService;
  private xService!: XService;
  private aiService!: AIService;
  private notificationService!: NotificationService;
  private engagementService!: EngagementService;
  private authService!: AuthService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ 
      server: this.server,
      path: '/ws'
    });

    this.configureMiddleware();
    this.configureWebSocket();
    this.setupErrorHandling();
  }

  private async initializeServices() {
    this.databaseService = new DatabaseService();
    await this.databaseService.initialize();

    this.xService = new XService();
    this.aiService = new AIService();
    this.authService = new AuthService(this.databaseService);
    
    // Initialize auth database tables
    await this.authService.initializeDatabase();
    
    this.notificationService = new NotificationService(
      this.databaseService,
      this.xService,
      this.wss
    );
    this.engagementService = new EngagementService(
      this.databaseService,
      this.xService,
      this.wss
    );
  }

  private configureMiddleware() {
    // Security middleware
    this.app.use(helmet());
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use(limiter);

    // CORS
    this.app.use(cors({
      origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));

    // Session middleware for Passport
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'xnom-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Session middleware (for Passport)
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'xnom-session-secret-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));

    // Request logging for debugging
    this.app.use((req, res, next) => {
      console.log(`📥 ${req.method} ${req.path} from ${req.ip}`);
      next();
    });

    // NOTE: Static files middleware moved to configureRoutes() to prevent route conflicts
  }

  private configureAuth() {
    // Initialize Passport after auth service is created
    this.app.use(this.authService.getPassportInstance().initialize());
    this.app.use(this.authService.getPassportInstance().session());
    console.log('  🔐 Passport authentication configured');
  }

  private configureRoutes() {
    console.log('🔧 Configuring routes...');
    
    try {
      // Inject services into route handlers
      console.log('  📦 Injecting services into routes...');
      setNotificationService(this.notificationService);
      setEngagementService(this.engagementService);
      setServices(this.databaseService, this.aiService);
      setDatabaseService(this.databaseService);
      setAuthService(this.authService);
      console.log('  ✅ Services injected successfully');

      // Configure authentication after services are injected
      this.configureAuth();

      // Health check (before API routes)
      console.log('  🏥 Setting up health endpoint...');
      this.app.get('/health', (req, res) => {
        console.log('  💓 Health check requested from:', req.ip, req.headers['user-agent']);
        res.json({ 
          status: 'healthy', 
          timestamp: new Date().toISOString(),
          services: {
            database: this.databaseService.isConnected(),
            x_api: this.xService.isConnected(),
            ai: this.aiService.isAvailable()
          }
        });
      });
      
      // Add a simple test route for debugging
      this.app.get('/test', (req, res) => {
        console.log('  🧪 Test endpoint requested from:', req.ip);
        res.json({ message: 'Test endpoint working!' });
      });
      
      console.log('  ✅ Health endpoint configured');

      // Authentication routes (must be before protected API routes)
      console.log('  🔐 Setting up auth routes...');
      this.app.use('/auth', authRoutes);
      console.log('  ✅ Auth routes configured');

      // API routes (notifications allowed, others restricted)
      console.log('  🛤️  Setting up API routes...');
      this.app.use('/api/notifications', this.authService.requireAuth, notificationRoutes);
      
      // Block access to other API routes for OAuth users - only notifications allowed
      this.app.use('/api/engagement', (req, res) => {
        res.status(403).json({
          success: false,
          error: 'Access denied. X OAuth users can only access notifications.',
          message: 'You are authenticated with X, but only notification access is permitted.',
          allowedEndpoints: ['/api/notifications']
        });
      });
      
      this.app.use('/api/post-ideas', (req, res) => {
        res.status(403).json({
          success: false,
          error: 'Access denied. X OAuth users can only access notifications.',
          message: 'You are authenticated with X, but only notification access is permitted.',
          allowedEndpoints: ['/api/notifications']
        });
      });
      
      this.app.use('/api/settings', (req, res) => {
        res.status(403).json({
          success: false,
          error: 'Access denied. X OAuth users can only access notifications.',
          message: 'You are authenticated with X, but only notification access is permitted.',
          allowedEndpoints: ['/api/notifications']
        });
      });
      
      console.log('  ✅ API routes configured');
      
      // Catch-all for any other API routes
      this.app.use('/api/*', (req, res) => {
        res.status(403).json({
          success: false,
          error: 'Access denied. X OAuth users can only access notifications.',
          message: 'You are authenticated with X, but only notification access is permitted.',
          allowedEndpoints: ['/api/notifications']
        });
      });

      // Serve static files from public directory
      console.log('  📁 Setting up static file serving...');
      this.app.use(express.static(path.join(__dirname, '../public')));
      console.log('  ✅ Static files configured');

      // Serve frontend (catch-all route must be LAST)
      console.log('  🖥️  Setting up frontend fallback route...');
      this.app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
      });
      console.log('  ✅ Frontend fallback route configured');
      
      console.log('✅ All routes configured successfully');
    } catch (error) {
      console.error('❌ Error configuring routes:', error);
      throw error;
    }
  }

  private configureWebSocket() {
    this.wss.on('connection', (ws, request) => {
      console.log('New WebSocket connection established');

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          this.handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to XNOM WebSocket server',
        timestamp: new Date().toISOString()
      }));
    });
  }

  private handleWebSocketMessage(ws: any, data: any) {
    switch (data.type) {
      case 'subscribe_notifications':
        // Handle notification subscription
        break;
      case 'subscribe_engagement':
        // Handle engagement updates subscription
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  }

  private setupErrorHandling() {
    // Global error handler
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Global error handler:', err);
      
      if (res.headersSent) {
        return next(err);
      }

      res.status(err.status || 500).json({
        error: {
          message: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
          status: err.status || 500
        }
      });
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: {
          message: 'Route not found',
          status: 404
        }
      });
    });
  }

  public async start() {
    const port = process.env.PORT || 3000;
    
    try {
      await this.initializeServices();
      
      // Configure routes AFTER services are initialized
      this.configureRoutes();
      
      // Start background services
      this.notificationService.startMonitoring();
      this.engagementService.startAutoEngagement();

      this.server.listen(port, () => {
        console.log(`🚀 XNOM server is running on port ${port}`);
        console.log(`📡 WebSocket server is running on ws://localhost:${port}/ws`);
        console.log(`🌐 Dashboard available at http://localhost:${port}`);
      });
    } catch (error) {
      console.error('Failed to start XNOM server:', error);
      process.exit(1);
    }
  }

  public async stop() {
    console.log('Shutting down XNOM server...');
    
    // Stop background services
    this.notificationService.stopMonitoring();
    this.engagementService.stopAutoEngagement();
    
    // Close WebSocket server
    this.wss.close();
    
    // Close HTTP server
    this.server.close();
    
    // Close database connection
    await this.databaseService.close();
    
    console.log('XNOM server shut down successfully');
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  if (app) {
    await app.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  if (app) {
    await app.stop();
  }
  process.exit(0);
});

// Start the application
const app = new XNOMApp();
app.start().catch(console.error);

export default XNOMApp;
