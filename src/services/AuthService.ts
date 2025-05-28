import passport from 'passport';
import { Strategy as TwitterStrategy } from 'passport-twitter';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService } from './DatabaseService';
import { User, JWTPayload } from '../types';

export class AuthService {
  private databaseService: DatabaseService;
  private jwtSecret: string;

  constructor(databaseService: DatabaseService) {
    this.databaseService = databaseService;
    this.jwtSecret = process.env.JWT_SECRET || 'xnom-secret-key-change-in-production';
    this.configurePassport();
  }

  private configurePassport() {
    // Twitter OAuth Strategy
    passport.use(new TwitterStrategy({
      consumerKey: process.env.TWITTER_CONSUMER_KEY || '',
      consumerSecret: process.env.TWITTER_CONSUMER_SECRET || '',
      callbackURL: process.env.TWITTER_CALLBACK_URL || '/auth/twitter/callback'
    }, async (token: string, tokenSecret: string, profile: any, done: any) => {
      try {
        console.log('🔐 Twitter OAuth profile received:', {
          id: profile.id,
          username: profile.username,
          displayName: profile.displayName
        });

        // Check if user exists
        let user = await this.getUserByXUserId(profile.id);

        if (user) {
          // Update existing user
          user.accessToken = token;
          user.accessTokenSecret = tokenSecret;
          user.lastLoginAt = new Date();
          await this.updateUser(user);
        } else {
          // Create new user
          user = {
            id: `user_${profile.id}`,
            userId: `user_${profile.id}`,
            xUserId: profile.id,
            username: profile.username,
            displayName: profile.displayName,
            profileImageUrl: profile.photos?.[0]?.value,
            accessToken: token,
            accessTokenSecret: tokenSecret,
            createdAt: new Date(),
            lastLoginAt: new Date()
          };
          await this.createUser(user);
        }

        return done(null, user);
      } catch (error) {
        console.error('Error in Twitter OAuth strategy:', error);
        return done(error, null);
      }
    }));

    // Serialize/deserialize user for session
    passport.serializeUser((user: any, done) => {
      done(null, user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
      try {
        const user = await this.getUserById(id);
        done(null, user);
      } catch (error) {
        done(error, null);
      }
    });
  }

  public getPassportInstance() {
    return passport;
  }

  public generateJWT(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId: user.userId,
      xUserId: user.xUserId,
      username: user.username
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '7d' // Token expires in 7 days
    });
  }

  public verifyJWT(token: string): JWTPayload | null {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }
  }

  // Middleware to require authentication
  public requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = this.extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided'
      });
    }

    const payload = this.verifyJWT(token);
    if (!payload) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    req.user = payload;
    next();
  };

  // Middleware for optional authentication
  public optionalAuth = (req: Request, res: Response, next: NextFunction) => {
    const token = this.extractToken(req);

    if (token) {
      const payload = this.verifyJWT(token);
      if (payload) {
        req.user = payload;
      }
    }

    next();
  };

  private extractToken(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Also check query params for token (useful for OAuth redirects)
    if (req.query.token && typeof req.query.token === 'string') {
      return req.query.token;
    }
    
    return null;
  }

  // Database operations
  private async createUser(user: User): Promise<void> {
    await this.databaseService.run(
      `INSERT INTO users (id, user_id, x_user_id, username, display_name, profile_image_url, access_token, access_token_secret, created_at, last_login_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        user.id,
        user.userId,
        user.xUserId,
        user.username,
        user.displayName,
        user.profileImageUrl,
        user.accessToken,
        user.accessTokenSecret,
        user.createdAt.toISOString(),
        user.lastLoginAt?.toISOString()
      ]
    );

    console.log(`✅ Created new user: ${user.username} (${user.xUserId})`);
  }

  private async updateUser(user: User): Promise<void> {
    await this.databaseService.run(
      `UPDATE users SET 
       username = ?, display_name = ?, profile_image_url = ?, 
       access_token = ?, access_token_secret = ?, last_login_at = ?
       WHERE id = ?`,
      [
        user.username,
        user.displayName,
        user.profileImageUrl,
        user.accessToken,
        user.accessTokenSecret,
        user.lastLoginAt?.toISOString(),
        user.id
      ]
    );

    console.log(`✅ Updated user: ${user.username} (${user.xUserId})`);
  }

  public async getUserById(id: string): Promise<User | null> {
    const row = await this.databaseService.get(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    return row ? this.mapRowToUser(row) : null;
  }

  public async getUserByXUserId(xUserId: string): Promise<User | null> {
    const row = await this.databaseService.get(
      'SELECT * FROM users WHERE x_user_id = ?',
      [xUserId]
    );

    return row ? this.mapRowToUser(row) : null;
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      userId: row.user_id,
      xUserId: row.x_user_id,
      username: row.username,
      displayName: row.display_name,
      profileImageUrl: row.profile_image_url,
      accessToken: row.access_token,
      accessTokenSecret: row.access_token_secret,
      createdAt: new Date(row.created_at),
      lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined
    };
  }

  // Initialize users table
  public async initializeDatabase(): Promise<void> {
    await this.databaseService.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL,
        x_user_id TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        profile_image_url TEXT,
        access_token TEXT,
        access_token_secret TEXT,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      )
    `);

    console.log('✅ Users table initialized');
  }
}