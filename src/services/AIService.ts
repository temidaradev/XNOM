import OpenAI from 'openai';

export class AIService {
  private openai: OpenAI | null = null;
  private provider: 'openai' | 'anthropic';

  constructor() {
    this.provider = process.env.AI_PROVIDER as 'openai' | 'anthropic' || 'openai';
    
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
    }
  }

  async analyzePostIdea(content: string): Promise<{
    score: number;
    category: string;
    analysis: string;
    suggestions: string[];
    approved: boolean;
  }> {
    try {
      const prompt = `
        Analyze this X (Twitter) post idea and provide a detailed evaluation:
        
        Post Content: "${content}"
        
        Please evaluate based on:
        1. Engagement potential (1-10)
        2. Content quality (1-10)
        3. Relevance and timeliness (1-10)
        4. Brand safety (1-10)
        5. Potential reach (1-10)
        
        Provide your response in JSON format:
        {
          "overallScore": number (1-10),
          "category": "string (one of: tech, business, personal, humor, news, opinion, educational)",
          "analysis": "detailed analysis of the post",
          "suggestions": ["array of improvement suggestions"],
          "approved": boolean,
          "engagementPotential": number (1-10),
          "contentQuality": number (1-10),
          "relevance": number (1-10),
          "brandSafety": number (1-10),
          "potentialReach": number (1-10),
          "risks": ["array of potential risks"],
          "keywords": ["relevant keywords for this post"]
        }
      `;

      const response = await this.openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert social media strategist and content analyst. Analyze X (Twitter) posts for engagement potential, quality, and effectiveness. Be constructive but honest in your analysis.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });

      const analysisText = response?.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis received from AI');
      }

      // Parse JSON response
      const analysis = JSON.parse(analysisText);
      
      return {
        score: analysis.overallScore || 5,
        category: analysis.category || 'general',
        analysis: analysis.analysis || 'Analysis not available',
        suggestions: analysis.suggestions || [],
        approved: analysis.approved || false
      };

    } catch (error) {
      console.error('Error analyzing post idea:', error);
      
      // Fallback analysis
      return {
        score: 5,
        category: 'general',
        analysis: 'AI analysis temporarily unavailable. Manual review recommended.',
        suggestions: ['Review content for engagement potential', 'Check for brand safety'],
        approved: false
      };
    }
  }

  async generatePostIdeas(topic: string, count: number = 5): Promise<any[]> {
    try {
      const prompt = `
        Generate ${count} high-quality X (Twitter) post ideas about "${topic}".
        
        Each post should be:
        - Engaging and thought-provoking
        - Under 280 characters
        - Relevant to current trends
        - Likely to generate interaction
        
        Provide your response in JSON format as an array of objects:
        [
          {
            "content": "the tweet content",
            "category": "category type",
            "reasoning": "why this post would be effective",
            "hashtags": ["relevant", "hashtags"],
            "estimatedEngagement": "low/medium/high"
          }
        ]
      `;

      const response = await this.openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a creative social media strategist specializing in X (Twitter) content. Generate engaging, original post ideas that drive interaction and provide value to readers.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const ideasText = response?.choices[0]?.message?.content;
      if (!ideasText) {
        throw new Error('No ideas generated');
      }

      const ideas = JSON.parse(ideasText);
      return Array.isArray(ideas) ? ideas : [];

    } catch (error) {
      console.error('Error generating post ideas:', error);
      return [];
    }
  }

  async analyzeEngagementPotential(tweetText: string, context: any = {}): Promise<{
    shouldEngage: boolean;
    confidence: number;
    reasoning: string;
  }> {
    try {
      const prompt = `
        Analyze this X (Twitter) post to determine if it's worth engaging with (liking, retweeting, or replying):
        
        Tweet: "${tweetText}"
        Context: ${JSON.stringify(context)}
        
        Consider:
        1. Content quality and relevance
        2. Potential for meaningful conversation
        3. Alignment with professional goals
        4. Risk assessment (controversial topics, spam, etc.)
        5. Engagement metrics if available
        
        Respond in JSON format:
        {
          "shouldEngage": boolean,
          "confidence": number (0-1),
          "reasoning": "explanation of recommendation",
          "engagementType": "like|retweet|reply|none",
          "riskLevel": "low|medium|high"
        }
      `;

      const response = await this.openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant that helps with social media engagement decisions. Analyze content quality, engagement potential, and risks to provide smart engagement recommendations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.2,
        max_tokens: 500
      });

      const analysisText = response?.choices[0]?.message?.content;
      if (!analysisText) {
        throw new Error('No analysis received');
      }

      const analysis = JSON.parse(analysisText);
      
      return {
        shouldEngage: analysis.shouldEngage || false,
        confidence: analysis.confidence || 0.5,
        reasoning: analysis.reasoning || 'No reasoning provided'
      };

    } catch (error) {
      console.error('Error analyzing engagement potential:', error);
      
      // Conservative fallback
      return {
        shouldEngage: false,
        confidence: 0.1,
        reasoning: 'AI analysis failed - manual review recommended'
      };
    }
  }

  async generateReplyText(originalTweet: string, context: string = ''): Promise<string> {
    try {
      const prompt = `
        Generate a thoughtful reply to this X (Twitter) post:
        
        Original Tweet: "${originalTweet}"
        Context: ${context}
        
        The reply should be:
        - Relevant and adding value to the conversation
        - Professional but engaging
        - Under 280 characters
        - Likely to generate positive engagement
        - Avoiding controversial topics unless directly relevant
        
        Just provide the reply text, no additional formatting.
      `;

      const response = await this.openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that generates thoughtful, engaging replies to social media posts. Focus on adding value and fostering positive interaction.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.6,
        max_tokens: 100
      });

      return response?.choices[0]?.message?.content?.trim() || '';

    } catch (error) {
      console.error('Error generating reply:', error);
      return '';
    }
  }

  async moderateContent(content: string): Promise<{
    isAppropriate: boolean;
    issues: string[];
    severity: 'low' | 'medium' | 'high';
  }> {
    try {
      const prompt = `
        Moderate this content for appropriateness on X (Twitter):
        
        Content: "${content}"
        
        Check for:
        - Hate speech or harassment
        - Spam or promotional content
        - Misinformation
        - Adult content
        - Violence or threats
        - Copyright issues
        
        Respond in JSON format:
        {
          "isAppropriate": boolean,
          "issues": ["array of identified issues"],
          "severity": "low|medium|high",
          "recommendations": ["suggestions for improvement"]
        }
      `;

      const response = await this.openai?.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a content moderation AI. Analyze content for policy violations and inappropriate material according to social media platform guidelines.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      const moderationText = response?.choices[0]?.message?.content;
      if (!moderationText) {
        throw new Error('No moderation result received');
      }

      const moderation = JSON.parse(moderationText);
      
      return {
        isAppropriate: moderation.isAppropriate || false,
        issues: moderation.issues || [],
        severity: moderation.severity || 'medium'
      };

    } catch (error) {
      console.error('Error moderating content:', error);
      
      // Conservative fallback
      return {
        isAppropriate: false,
        issues: ['Unable to analyze content'],
        severity: 'medium'
      };
    }
  }

  isAvailable(): boolean {
    return this.openai !== null;
  }

  getProvider(): string {
    return this.provider;
  }
}
