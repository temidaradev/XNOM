export interface XNotification {
  id: string;
  type: 'mention' | 'reply' | 'like' | 'retweet' | 'follow' | 'dm';
  userId: string;
  username: string;
  text: string;
  timestamp: Date;
  tweetId?: string;
  processed: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface PostIdea {
  id: string;
  content: string;
  score: number;
  category: string;
  aiAnalysis: string;
  approved: boolean;
  createdAt: Date;
  scheduledFor?: Date;
}

export interface EngagementSettings {
  autoLikeEnabled: boolean;
  highEngagementThreshold: number;
  maxLikesPerHour: number;
  engagementDelay: number;
  targetKeywords: string[];
  excludeKeywords: string[];
}

export interface UserSettings {
  id: string;
  xUserId: string;
  notificationSettings: {
    mentions: boolean;
    replies: boolean;
    likes: boolean;
    retweets: boolean;
    follows: boolean;
    dms: boolean;
  };
  engagementSettings: EngagementSettings;
  aiPreferences: {
    provider: 'openai' | 'anthropic';
    model: string;
    creativityLevel: number;
  };
}

export interface EngagementAction {
  id: string;
  type: 'like' | 'retweet' | 'reply';
  tweetId: string;
  userId: string;
  timestamp: Date;
  success: boolean;
  retryCount: number;
  error?: string;
}

export interface User {
  id: string;
  userId: string;
  xUserId: string;
  username: string;
  displayName: string;
  profileImageUrl?: string;
  accessToken?: string;
  accessTokenSecret?: string;
  createdAt: Date;
  lastLoginAt?: Date;
}

export interface JWTPayload {
  userId: string;
  xUserId: string;
  username: string;
  iat: number;
  exp: number;
}
