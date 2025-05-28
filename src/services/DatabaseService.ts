import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = process.env.DATABASE_PATH || './data/xnom.db';
  }

  async initialize(): Promise<void> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath);
      
      // Promisify database methods
      const run = promisify(this.db.run.bind(this.db));
      
      // Create tables
      await this.createTables(run);
      
      console.log('✅ Database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(run: any): Promise<void> {
    // User settings table
    await run(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id TEXT PRIMARY KEY,
        x_user_id TEXT UNIQUE NOT NULL,
        notification_settings TEXT NOT NULL,
        engagement_settings TEXT NOT NULL,
        ai_preferences TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Notifications table
    await run(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        text TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        tweet_id TEXT,
        processed BOOLEAN DEFAULT FALSE,
        priority TEXT DEFAULT 'medium',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Post ideas table
    await run(`
      CREATE TABLE IF NOT EXISTS post_ideas (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        score REAL NOT NULL,
        category TEXT NOT NULL,
        ai_analysis TEXT NOT NULL,
        approved BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        scheduled_for DATETIME
      )
    `);

    // Engagement actions table
    await run(`
      CREATE TABLE IF NOT EXISTS engagement_actions (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        tweet_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        timestamp DATETIME NOT NULL,
        success BOOLEAN NOT NULL,
        retry_count INTEGER DEFAULT 0,
        error TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better performance
    await run('CREATE INDEX IF NOT EXISTS idx_notifications_processed ON notifications(processed)');
    await run('CREATE INDEX IF NOT EXISTS idx_notifications_timestamp ON notifications(timestamp)');
    await run('CREATE INDEX IF NOT EXISTS idx_post_ideas_approved ON post_ideas(approved)');
    await run('CREATE INDEX IF NOT EXISTS idx_engagement_actions_tweet_id ON engagement_actions(tweet_id)');
  }

  async run(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
    });
  }

  async get(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async all(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async saveUserSettings(settings: any): Promise<void> {
    const sql = `
      INSERT OR REPLACE INTO user_settings 
      (id, x_user_id, notification_settings, engagement_settings, ai_preferences, updated_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    await this.run(sql, [
      settings.id,
      settings.xUserId,
      JSON.stringify(settings.notificationSettings),
      JSON.stringify(settings.engagementSettings),
      JSON.stringify(settings.aiPreferences)
    ]);
  }

  async getUserSettings(xUserId: string): Promise<any> {
    const sql = 'SELECT * FROM user_settings WHERE x_user_id = ?';
    const row = await this.get(sql, [xUserId]);
    
    if (!row) return null;
    
    return {
      id: row.id,
      xUserId: row.x_user_id,
      notificationSettings: JSON.parse(row.notification_settings),
      engagementSettings: JSON.parse(row.engagement_settings),
      aiPreferences: JSON.parse(row.ai_preferences)
    };
  }

  async saveNotification(notification: any): Promise<void> {
    const sql = `
      INSERT INTO notifications 
      (id, type, user_id, username, text, timestamp, tweet_id, processed, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      notification.id,
      notification.type,
      notification.userId,
      notification.username,
      notification.text,
      notification.timestamp,
      notification.tweetId,
      notification.processed,
      notification.priority
    ]);
  }

  async getUnprocessedNotifications(): Promise<any[]> {
    const sql = 'SELECT * FROM notifications WHERE processed = FALSE ORDER BY timestamp DESC';
    return await this.all(sql);
  }

  async markNotificationProcessed(id: string): Promise<void> {
    const sql = 'UPDATE notifications SET processed = TRUE WHERE id = ?';
    await this.run(sql, [id]);
  }

  async savePostIdea(idea: any): Promise<void> {
    const sql = `
      INSERT INTO post_ideas 
      (id, content, score, category, ai_analysis, approved, scheduled_for)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      idea.id,
      idea.content,
      idea.score,
      idea.category,
      idea.aiAnalysis,
      idea.approved,
      idea.scheduledFor
    ]);
  }

  async getPostIdeas(approved?: boolean): Promise<any[]> {
    let sql = 'SELECT * FROM post_ideas';
    const params: any[] = [];
    
    if (approved !== undefined) {
      sql += ' WHERE approved = ?';
      params.push(approved);
    }
    
    sql += ' ORDER BY score DESC, created_at DESC';
    
    return await this.all(sql, params);
  }

  async saveEngagementAction(action: any): Promise<void> {
    const sql = `
      INSERT INTO engagement_actions 
      (id, type, tweet_id, user_id, timestamp, success, retry_count, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    await this.run(sql, [
      action.id,
      action.type,
      action.tweetId,
      action.userId,
      action.timestamp,
      action.success,
      action.retryCount,
      action.error
    ]);
  }

  async getEngagementStats(hours: number = 24): Promise<any> {
    const sql = `
      SELECT 
        type,
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
      FROM engagement_actions 
      WHERE timestamp > datetime('now', '-${hours} hours')
      GROUP BY type
    `;
    
    return await this.all(sql);
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }
}
