import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from './DatabaseService';
import { XService } from './XService';
import { AIService } from './AIService';
import { XNotification } from '../types';

export class NotificationService {
  private databaseService: DatabaseService;
  private xService: XService;
  private aiService: AIService;
  private wss: WebSocketServer;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring: boolean = false;

  constructor(
    databaseService: DatabaseService,
    xService: XService,
    wss: WebSocketServer
  ) {
    this.databaseService = databaseService;
    this.xService = xService;
    this.aiService = new AIService();
    this.wss = wss;
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Notification monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    const intervalMs = parseInt(process.env.CHECK_NOTIFICATIONS_INTERVAL || '30000');
    
    console.log(`📡 Starting notification monitoring (checking every ${intervalMs}ms)`);
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewNotifications();
      } catch (error) {
        console.error('Error during notification check:', error);
      }
    }, intervalMs);

    // Initial check
    this.checkForNewNotifications();
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      this.isMonitoring = false;
      console.log('📡 Notification monitoring stopped');
    }
  }

  private async checkForNewNotifications(): Promise<void> {
    try {
      console.log('🔍 Checking for new notifications...');
      
      // Get mentions (primary notification type)
      const mentions = await this.xService.getNotifications();
      
      for (const mention of mentions) {
        await this.processNotification(mention);
      }

      // Broadcast update to connected clients
      this.broadcastToClients({
        type: 'notifications_checked',
        timestamp: new Date().toISOString(),
        count: mentions.length
      });

    } catch (error) {
      console.error('Failed to check notifications:', error);
      
      this.broadcastToClients({
        type: 'error',
        message: 'Failed to check notifications',
        timestamp: new Date().toISOString()
      });
    }
  }

  private async processNotification(rawNotification: any): Promise<void> {
    try {
      // Check if we already processed this notification
      const existingNotification = await this.databaseService.get(
        'SELECT id FROM notifications WHERE id = ?',
        [rawNotification.id]
      );

      if (existingNotification) {
        return; // Already processed
      }

      // Convert to our notification format
      const notification: XNotification = {
        id: rawNotification.id,
        type: this.determineNotificationType(rawNotification),
        userId: rawNotification.author_id,
        username: rawNotification.author?.username || 'unknown',
        text: rawNotification.text || '',
        timestamp: new Date(rawNotification.created_at),
        tweetId: rawNotification.id,
        processed: false,
        priority: await this.calculatePriority(rawNotification)
      };

      // Save to database
      await this.databaseService.saveNotification(notification);

      // AI analysis for intelligent filtering
      const shouldNotify = await this.shouldNotifyUser(notification);
      
      if (shouldNotify) {
        // Send real-time notification to clients
        this.broadcastToClients({
          type: 'new_notification',
          notification: notification,
          timestamp: new Date().toISOString()
        });

        console.log(`📩 New ${notification.type} from @${notification.username}: ${notification.text.substring(0, 50)}...`);
      }

      // Mark as processed
      await this.databaseService.markNotificationProcessed(notification.id);

    } catch (error) {
      console.error('Error processing notification:', error);
    }
  }

  private determineNotificationType(rawNotification: any): XNotification['type'] {
    // This is simplified - in reality, you'd need to check the notification context
    if (rawNotification.referenced_tweets?.some((ref: any) => ref.type === 'replied_to')) {
      return 'reply';
    }
    
    if (rawNotification.text?.includes('@')) {
      return 'mention';
    }

    return 'mention'; // Default
  }

  private async calculatePriority(rawNotification: any): Promise<'low' | 'medium' | 'high'> {
    try {
      // Factors that increase priority:
      // - Verified account
      // - High follower count
      // - High engagement on the tweet
      // - Contains urgent keywords
      
      let priorityScore = 0;

      // Check if author is verified
      if (rawNotification.author?.verified) {
        priorityScore += 30;
      }

      // Check engagement metrics
      const metrics = rawNotification.public_metrics;
      if (metrics) {
        const engagement = (metrics.like_count || 0) + 
                          (metrics.retweet_count || 0) + 
                          (metrics.reply_count || 0);
        
        if (engagement > 100) priorityScore += 25;
        else if (engagement > 20) priorityScore += 15;
        else if (engagement > 5) priorityScore += 10;
      }

      // Check for urgent keywords
      const urgentKeywords = ['urgent', 'important', 'breaking', 'emergency', 'please help'];
      const text = rawNotification.text?.toLowerCase() || '';
      
      for (const keyword of urgentKeywords) {
        if (text.includes(keyword)) {
          priorityScore += 20;
          break;
        }
      }

      // Check for business-related keywords
      const businessKeywords = ['collaboration', 'partnership', 'opportunity', 'business', 'project'];
      for (const keyword of businessKeywords) {
        if (text.includes(keyword)) {
          priorityScore += 15;
          break;
        }
      }

      // Convert score to priority level
      if (priorityScore >= 50) return 'high';
      if (priorityScore >= 25) return 'medium';
      return 'low';

    } catch (error) {
      console.error('Error calculating priority:', error);
      return 'medium';
    }
  }

  private async shouldNotifyUser(notification: XNotification): Promise<boolean> {
    try {
      // Get user settings (for now, we'll use default settings)
      // In a real app, you'd fetch user-specific settings
      const defaultSettings = {
        mentions: true,
        replies: true,
        likes: false,
        retweets: false,
        follows: true,
        dms: true
      };

      // Check if this notification type is enabled
      const notificationType = notification.type as keyof typeof defaultSettings;
      if (!defaultSettings[notificationType]) {
        return false;
      }

      // Use AI to filter out spam or irrelevant notifications
      if (this.aiService.isAvailable()) {
        const analysis = await this.aiService.analyzeEngagementPotential(
          notification.text,
          { type: notification.type, priority: notification.priority }
        );

        // Only notify if AI thinks it's worth attention
        if (analysis.confidence < 0.3) {
          console.log(`🤖 AI filtered out notification from @${notification.username} (confidence: ${analysis.confidence})`);
          return false;
        }
      }

      return true;

    } catch (error) {
      console.error('Error determining if should notify:', error);
      return true; // Default to notifying on error
    }
  }

  private broadcastToClients(message: any): void {
    this.wss.clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(JSON.stringify(message));
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    });
  }

  async getNotifications(limit: number = 50, offset: number = 0): Promise<XNotification[]> {
    try {
      const sql = `
        SELECT * FROM notifications 
        ORDER BY timestamp DESC 
        LIMIT ? OFFSET ?
      `;
      
      const rows = await this.databaseService.all(sql, [limit, offset]);
      
      return rows.map(row => ({
        id: row.id,
        type: row.type,
        userId: row.user_id,
        username: row.username,
        text: row.text,
        timestamp: new Date(row.timestamp),
        tweetId: row.tweet_id,
        processed: Boolean(row.processed),
        priority: row.priority
      }));

    } catch (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
  }

  async getNotificationStats(): Promise<any> {
    try {
      const stats = await this.databaseService.all(`
        SELECT 
          type,
          priority,
          COUNT(*) as count,
          MAX(timestamp) as latest
        FROM notifications 
        WHERE timestamp > datetime('now', '-24 hours')
        GROUP BY type, priority
        ORDER BY count DESC
      `);

      const totalToday = await this.databaseService.get(`
        SELECT COUNT(*) as total 
        FROM notifications 
        WHERE timestamp > datetime('now', '-24 hours')
      `);

      return {
        totalToday: totalToday.total || 0,
        breakdown: stats,
        isMonitoring: this.isMonitoring,
        lastCheck: new Date().toISOString()
      };

    } catch (error) {
      console.error('Error fetching notification stats:', error);
      return {
        totalToday: 0,
        breakdown: [],
        isMonitoring: this.isMonitoring,
        lastCheck: new Date().toISOString()
      };
    }
  }

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await this.databaseService.run(
        'UPDATE notifications SET processed = TRUE WHERE id = ?',
        [notificationId]
      );

      this.broadcastToClients({
        type: 'notification_read',
        notificationId: notificationId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  }

  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }
}
