import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import cron from 'node-cron';
import { DatabaseService } from './DatabaseService';
import { XService } from './XService';
import { AIService } from './AIService';
import { EngagementAction, EngagementSettings } from '../types';

export class EngagementService {
  private databaseService: DatabaseService;
  private xService: XService;
  private aiService: AIService;
  private wss: WebSocketServer;
  private isAutoEngagementActive: boolean = false;
  private engagementInterval: NodeJS.Timeout | null = null;
  private likesThisHour: number = 0;
  private hourlyResetInterval: NodeJS.Timeout | null = null;

  constructor(
    databaseService: DatabaseService,
    xService: XService,
    wss: WebSocketServer
  ) {
    this.databaseService = databaseService;
    this.xService = xService;
    this.aiService = new AIService();
    this.wss = wss;

    // Reset hourly counters every hour
    this.hourlyResetInterval = setInterval(() => {
      this.likesThisHour = 0;
      console.log('🔄 Hourly engagement counters reset');
    }, 60 * 60 * 1000);
  }

  startAutoEngagement(): void {
    if (this.isAutoEngagementActive) {
      console.log('⚠️ Auto-engagement is already running');
      return;
    }

    const autoEngagementEnabled = process.env.AUTO_ENGAGEMENT_ENABLED === 'true';
    if (!autoEngagementEnabled) {
      console.log('🚫 Auto-engagement is disabled in configuration');
      return;
    }

    this.isAutoEngagementActive = true;
    console.log('🤖 Starting auto-engagement service');

    // Check for high engagement tweets every 5 minutes
    this.engagementInterval = setInterval(async () => {
      try {
        await this.processHighEngagementTweets();
      } catch (error) {
        console.error('Error in auto-engagement cycle:', error);
      }
    }, 5 * 60 * 1000);

    // Initial run
    setTimeout(() => this.processHighEngagementTweets(), 5000);
  }

  stopAutoEngagement(): void {
    if (this.engagementInterval) {
      clearInterval(this.engagementInterval);
      this.engagementInterval = null;
      this.isAutoEngagementActive = false;
      console.log('🤖 Auto-engagement service stopped');
    }

    if (this.hourlyResetInterval) {
      clearInterval(this.hourlyResetInterval);
      this.hourlyResetInterval = null;
    }
  }

  private async processHighEngagementTweets(): Promise<void> {
    try {
      console.log('🔍 Searching for high engagement tweets to interact with...');

      const settings = await this.getEngagementSettings();
      
      // Check if we've hit our hourly limit
      if (this.likesThisHour >= settings.maxLikesPerHour) {
        console.log(`⏳ Hourly like limit reached (${this.likesThisHour}/${settings.maxLikesPerHour})`);
        return;
      }

      // Get high engagement tweets
      const tweets = await this.xService.getHighEngagementTweets(settings.highEngagementThreshold);
      
      if (tweets.length === 0) {
        console.log('📭 No high engagement tweets found');
        return;
      }

      console.log(`📊 Found ${tweets.length} high engagement tweets`);

      for (const tweet of tweets) {
        // Check if we've already engaged with this tweet
        const existingAction = await this.databaseService.get(
          'SELECT id FROM engagement_actions WHERE tweet_id = ? AND type = "like"',
          [tweet.id]
        );

        if (existingAction) {
          continue; // Skip if already liked
        }

        // Check hourly limit again
        if (this.likesThisHour >= settings.maxLikesPerHour) {
          break;
        }

        // AI analysis to determine if we should engage
        const shouldEngage = await this.shouldEngageWithTweet(tweet, settings);
        
        if (shouldEngage) {
          await this.engageWithTweet(tweet, 'like', settings);
          
          // Add delay between engagements to appear more natural
          await this.delay(settings.engagementDelay);
        }
      }

    } catch (error) {
      console.error('Error processing high engagement tweets:', error);
    }
  }

  private async shouldEngageWithTweet(tweet: any, settings: EngagementSettings): Promise<boolean> {
    try {
      // Basic checks first
      const tweetText = tweet.text?.toLowerCase() || '';
      
      // Check exclude keywords
      for (const keyword of settings.excludeKeywords) {
        if (tweetText.includes(keyword.toLowerCase())) {
          console.log(`🚫 Tweet contains excluded keyword: ${keyword}`);
          return false;
        }
      }

      // Check if contains target keywords (if any specified)
      if (settings.targetKeywords.length > 0) {
        const containsTargetKeyword = settings.targetKeywords.some(keyword =>
          tweetText.includes(keyword.toLowerCase())
        );
        
        if (!containsTargetKeyword) {
          return false;
        }
      }

      // Check engagement metrics
      const metrics = tweet.public_metrics || {};
      const totalEngagement = (metrics.like_count || 0) + 
                             (metrics.retweet_count || 0) + 
                             (metrics.reply_count || 0);

      if (totalEngagement < settings.highEngagementThreshold) {
        return false;
      }

      // AI analysis for more sophisticated filtering
      if (this.aiService.isAvailable()) {
        const aiAnalysis = await this.aiService.analyzeEngagementPotential(
          tweet.text,
          {
            metrics: metrics,
            author: tweet.author,
            created_at: tweet.created_at
          }
        );

        if (!aiAnalysis.shouldEngage || aiAnalysis.confidence < 0.6) {
          console.log(`🤖 AI recommends not engaging (confidence: ${aiAnalysis.confidence}): ${aiAnalysis.reasoning}`);
          return false;
        }

        console.log(`🤖 AI recommends engaging (confidence: ${aiAnalysis.confidence}): ${aiAnalysis.reasoning}`);
      }

      return true;

    } catch (error) {
      console.error('Error analyzing tweet for engagement:', error);
      return false; // Conservative approach on error
    }
  }

  private async engageWithTweet(tweet: any, type: 'like' | 'retweet' | 'reply', settings: EngagementSettings): Promise<void> {
    const actionId = uuidv4();
    const now = new Date();

    try {
      console.log(`💙 Attempting to ${type} tweet from @${tweet.author?.username}: ${tweet.text.substring(0, 50)}...`);

      let success = false;
      let error: string | undefined;

      switch (type) {
        case 'like':
          success = await this.xService.retryLikeTweet(tweet.id, 3);
          if (success) {
            this.likesThisHour++;
          }
          break;
          
        case 'retweet':
          success = await this.xService.retweetTweet(tweet.id);
          break;
          
        case 'reply':
          // Generate AI reply if available
          if (this.aiService.isAvailable()) {
            const replyText = await this.aiService.generateReplyText(tweet.text);
            if (replyText) {
              const replyTweet = await this.xService.replyToTweet(tweet.id, replyText);
              success = !!replyTweet;
            }
          }
          break;
      }

      // Save engagement action to database
      const action: EngagementAction = {
        id: actionId,
        type: type,
        tweetId: tweet.id,
        userId: tweet.author_id || 'unknown',
        timestamp: now,
        success: success,
        retryCount: type === 'like' ? 3 : 1,
        error: error
      };

      await this.databaseService.saveEngagementAction(action);

      // Broadcast to clients
      this.broadcastToClients({
        type: 'engagement_action',
        action: action,
        tweetAuthor: tweet.author?.username,
        tweetText: tweet.text.substring(0, 100),
        timestamp: now.toISOString()
      });

      if (success) {
        console.log(`✅ Successfully ${type}d tweet from @${tweet.author?.username}`);
      } else {
        console.log(`❌ Failed to ${type} tweet from @${tweet.author?.username}: ${error}`);
      }

    } catch (engagementError) {
      console.error(`Error engaging with tweet:`, engagementError);
      
      // Save failed action
      const failedAction: EngagementAction = {
        id: actionId,
        type: type,
        tweetId: tweet.id,
        userId: tweet.author_id || 'unknown',
        timestamp: now,
        success: false,
        retryCount: 1,
        error: engagementError instanceof Error ? engagementError.message : String(engagementError)
      };

      await this.databaseService.saveEngagementAction(failedAction);
    }
  }

  async likeSpecificTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(`👍 Manual like request for tweet: ${tweetId}`);
      
      // Check if we've already liked this tweet
      const existingAction = await this.databaseService.get(
        'SELECT id FROM engagement_actions WHERE tweet_id = ? AND type = "like" AND success = 1',
        [tweetId]
      );

      if (existingAction) {
        return { success: true }; // Already liked
      }

      const success = await this.xService.retryLikeTweet(tweetId, 3);
      
      // Save action
      const action: EngagementAction = {
        id: uuidv4(),
        type: 'like',
        tweetId: tweetId,
        userId: 'manual',
        timestamp: new Date(),
        success: success,
        retryCount: 3,
        error: success ? undefined : 'Failed to like tweet'
      };

      await this.databaseService.saveEngagementAction(action);

      if (success) {
        this.likesThisHour++;
        this.broadcastToClients({
          type: 'manual_engagement',
          action: 'like',
          tweetId: tweetId,
          success: true,
          timestamp: new Date().toISOString()
        });
      }

      return { success, error: success ? undefined : 'Failed to like tweet' };

    } catch (error) {
      console.error('Error in manual like:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  private async getEngagementSettings(): Promise<EngagementSettings> {
    // For now, return default settings
    // In a real app, you'd fetch user-specific settings from the database
    return {
      autoLikeEnabled: process.env.AUTO_ENGAGEMENT_ENABLED === 'true',
      highEngagementThreshold: parseInt(process.env.HIGH_ENGAGEMENT_THRESHOLD || '100'),
      maxLikesPerHour: parseInt(process.env.MAX_LIKES_PER_HOUR || '50'),
      engagementDelay: parseInt(process.env.ENGAGEMENT_DELAY_MS || '2000'),
      targetKeywords: [], // Could be loaded from settings
      excludeKeywords: [
        'porn', 'nsfw', 'adult', 'gambling', 'casino', 'crypto scam',
        'hate', 'racist', 'nazi', 'terrorist', 'violence', 'kill',
        'spam', 'bot', 'fake', 'scam', 'fraud'
      ]
    };
  }

  async getEngagementStats(hours: number = 24): Promise<any> {
    try {
      const stats = await this.databaseService.getEngagementStats(hours);
      
      const recentActions = await this.databaseService.all(`
        SELECT * FROM engagement_actions 
        WHERE timestamp > datetime('now', '-${hours} hours')
        ORDER BY timestamp DESC 
        LIMIT 10
      `);

      return {
        stats: stats,
        recentActions: recentActions,
        currentHourLikes: this.likesThisHour,
        isAutoEngagementActive: this.isAutoEngagementActive,
        settings: await this.getEngagementSettings()
      };

    } catch (error) {
      console.error('Error fetching engagement stats:', error);
      return {
        stats: [],
        recentActions: [],
        currentHourLikes: this.likesThisHour,
        isAutoEngagementActive: this.isAutoEngagementActive,
        settings: await this.getEngagementSettings()
      };
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public isAutoEngagementRunning(): boolean {
    return this.isAutoEngagementActive;
  }
}
