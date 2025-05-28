import axios, { AxiosInstance } from 'axios';

export class XService {
  private client: AxiosInstance;
  private bearerToken: string;
  private apiKey: string;
  private apiSecret: string;
  private accessToken: string;
  private accessTokenSecret: string;
  private rateLimitRemaining: number = 300;
  private rateLimitReset: number = Date.now();

  constructor() {
    this.bearerToken = process.env.X_BEARER_TOKEN || '';
    this.apiKey = process.env.X_API_KEY || '';
    this.apiSecret = process.env.X_API_SECRET || '';
    this.accessToken = process.env.X_ACCESS_TOKEN || '';
    this.accessTokenSecret = process.env.X_ACCESS_TOKEN_SECRET || '';

    this.client = axios.create({
      baseURL: 'https://api.twitter.com/2',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.bearerToken}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor for rate limiting
    this.client.interceptors.request.use(
      async (config) => {
        await this.checkRateLimit();
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for rate limit tracking
    this.client.interceptors.response.use(
      (response) => {
        this.updateRateLimitInfo(response.headers);
        return response;
      },
      (error) => {
        if (error.response) {
          this.updateRateLimitInfo(error.response.headers);
        }
        return Promise.reject(error);
      }
    );
  }

  private updateRateLimitInfo(headers: any) {
    const remaining = headers['x-rate-limit-remaining'];
    const reset = headers['x-rate-limit-reset'];
    
    if (remaining) this.rateLimitRemaining = parseInt(remaining);
    if (reset) this.rateLimitReset = parseInt(reset) * 1000;
  }

  private async checkRateLimit() {
    if (this.rateLimitRemaining <= 1 && Date.now() < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - Date.now();
      console.log(`Rate limit reached. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  async getNotifications(): Promise<any[]> {
    try {
      const response = await this.client.get('/users/me/mentions', {
        params: {
          'tweet.fields': 'created_at,public_metrics,context_annotations',
          'user.fields': 'username,verified,profile_image_url',
          'expansions': 'author_id,referenced_tweets.id',
          'max_results': 100
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  }

  async getTweet(tweetId: string): Promise<any> {
    try {
      const response = await this.client.get(`/tweets/${tweetId}`, {
        params: {
          'tweet.fields': 'created_at,public_metrics,context_annotations,author_id',
          'user.fields': 'username,verified,profile_image_url',
          'expansions': 'author_id'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error fetching tweet:', error);
      throw error;
    }
  }

  async likeTweet(tweetId: string): Promise<boolean> {
    try {
      // Get authenticated user ID
      const userResponse = await this.client.get('/users/me');
      const userId = userResponse.data.data.id;

      const response = await this.client.post(`/users/${userId}/likes`, {
        tweet_id: tweetId
      });

      return response.data.data?.liked || false;
    } catch (error) {
      console.error('Error liking tweet:', error);
      
      // Handle specific errors
      if (error && typeof error === 'object' && 'response' in error) {
        const errorResponse = error as { response?: { status?: number; data?: { detail?: string } } };
        if (errorResponse.response?.status === 403) {
          const errorDetail = errorResponse.response.data?.detail;
          if (errorDetail?.includes('already liked')) {
            console.log('Tweet already liked');
            return true;
          }
        }
      }
      
      throw error;
    }
  }

  async retryLikeTweet(tweetId: string, maxRetries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Add delay to prevent rapid-fire requests
        if (attempt > 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retrying like attempt ${attempt} after ${delay}ms delay...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const result = await this.likeTweet(tweetId);
        console.log(`Successfully liked tweet ${tweetId} on attempt ${attempt}`);
        return result;
      } catch (error) {
        console.error(`Like attempt ${attempt} failed for tweet ${tweetId}:`, error);
        
        if (attempt === maxRetries) {
          throw error;
        }
      }
    }
    
    return false;
  }

  async retweetTweet(tweetId: string): Promise<boolean> {
    try {
      const userResponse = await this.client.get('/users/me');
      const userId = userResponse.data.data.id;

      const response = await this.client.post(`/users/${userId}/retweets`, {
        tweet_id: tweetId
      });

      return response.data.data?.retweeted || false;
    } catch (error) {
      console.error('Error retweeting:', error);
      throw error;
    }
  }

  async replyToTweet(tweetId: string, text: string): Promise<any> {
    try {
      const response = await this.client.post('/tweets', {
        text: text,
        reply: {
          in_reply_to_tweet_id: tweetId
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error replying to tweet:', error);
      throw error;
    }
  }

  async postTweet(text: string): Promise<any> {
    try {
      const response = await this.client.post('/tweets', {
        text: text
      });

      return response.data.data;
    } catch (error) {
      console.error('Error posting tweet:', error);
      throw error;
    }
  }

  async searchTweets(query: string, maxResults: number = 10): Promise<any[]> {
    try {
      const response = await this.client.get('/tweets/search/recent', {
        params: {
          query: query,
          'tweet.fields': 'created_at,public_metrics,context_annotations,author_id',
          'user.fields': 'username,verified,profile_image_url',
          'expansions': 'author_id',
          'max_results': maxResults
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error('Error searching tweets:', error);
      throw error;
    }
  }

  async getHighEngagementTweets(threshold: number = 100): Promise<any[]> {
    try {
      // Search for recent tweets with high engagement
      const queries = [
        'has:links min_faves:' + threshold,
        'has:mentions min_retweets:' + Math.floor(threshold / 2),
        'min_replies:' + Math.floor(threshold / 4)
      ];

      const allTweets = [];
      
      for (const query of queries) {
        try {
          const tweets = await this.searchTweets(query, 20);
          allTweets.push(...tweets);
        } catch (error) {
          console.warn('Failed to search with query:', query, error);
        }
      }

      // Remove duplicates and sort by engagement
      const uniqueTweets = allTweets.filter((tweet, index, self) => 
        index === self.findIndex(t => t.id === tweet.id)
      );

      return uniqueTweets.sort((a, b) => {
        const engagementA = (a.public_metrics?.like_count || 0) + 
                           (a.public_metrics?.retweet_count || 0) + 
                           (a.public_metrics?.reply_count || 0);
        const engagementB = (b.public_metrics?.like_count || 0) + 
                           (b.public_metrics?.retweet_count || 0) + 
                           (b.public_metrics?.reply_count || 0);
        return engagementB - engagementA;
      });
    } catch (error) {
      console.error('Error fetching high engagement tweets:', error);
      return [];
    }
  }

  async getUserProfile(): Promise<any> {
    try {
      const response = await this.client.get('/users/me', {
        params: {
          'user.fields': 'created_at,description,entities,id,location,name,pinned_tweet_id,profile_image_url,protected,public_metrics,url,username,verified'
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }

  isConnected(): boolean {
    return !!(this.bearerToken && this.apiKey && this.apiSecret);
  }

  getRateLimitStatus(): { remaining: number; resetTime: number } {
    return {
      remaining: this.rateLimitRemaining,
      resetTime: this.rateLimitReset
    };
  }
}
