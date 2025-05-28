import express from 'express';
import { DatabaseService } from '../services/DatabaseService';

const router = express.Router();

let databaseService: DatabaseService;

export const setDatabaseService = (service: DatabaseService) => {
  databaseService = service;
};

// GET /api/settings - Get user settings
router.get('/', async (req, res) => {
  try {
    // For now, return default settings
    // In a real app, you'd get the authenticated user's settings
    const defaultSettings = {
      id: 'default',
      xUserId: 'user_default',
      notificationSettings: {
        mentions: true,
        replies: true,
        likes: false,
        retweets: false,
        follows: true,
        dms: true
      },
      engagementSettings: {
        autoLikeEnabled: process.env.AUTO_ENGAGEMENT_ENABLED === 'true',
        highEngagementThreshold: parseInt(process.env.HIGH_ENGAGEMENT_THRESHOLD || '100'),
        maxLikesPerHour: parseInt(process.env.MAX_LIKES_PER_HOUR || '50'),
        engagementDelay: parseInt(process.env.ENGAGEMENT_DELAY_MS || '2000'),
        targetKeywords: [],
        excludeKeywords: [
          'porn', 'nsfw', 'adult', 'gambling', 'casino', 'crypto scam',
          'hate', 'racist', 'nazi', 'terrorist', 'violence', 'kill',
          'spam', 'bot', 'fake', 'scam', 'fraud'
        ]
      },
      aiPreferences: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        creativityLevel: 0.7
      }
    };

    res.json({
      success: true,
      data: defaultSettings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
});

// PUT /api/settings - Update user settings
router.put('/', async (req, res) => {
  try {
    const settings = req.body;
    
    // Validate required fields
    if (!settings.id || !settings.xUserId) {
      return res.status(400).json({
        success: false,
        error: 'Settings must include id and xUserId'
      });
    }

    await databaseService.saveUserSettings(settings);
    
    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// PUT /api/settings/notifications - Update notification settings
router.put('/notifications', async (req, res) => {
  try {
    const { notificationSettings } = req.body;
    
    if (!notificationSettings) {
      return res.status(400).json({
        success: false,
        error: 'notificationSettings is required'
      });
    }

    // Get current settings and update only notification settings
    const currentSettings = await databaseService.getUserSettings('user_default') || {
      id: 'default',
      xUserId: 'user_default',
      notificationSettings: {},
      engagementSettings: {},
      aiPreferences: {}
    };

    currentSettings.notificationSettings = notificationSettings;
    await databaseService.saveUserSettings(currentSettings);
    
    res.json({
      success: true,
      message: 'Notification settings updated',
      data: currentSettings
    });
  } catch (error) {
    console.error('Error updating notification settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification settings'
    });
  }
});

// PUT /api/settings/engagement - Update engagement settings
router.put('/engagement', async (req, res) => {
  try {
    const { engagementSettings } = req.body;
    
    if (!engagementSettings) {
      return res.status(400).json({
        success: false,
        error: 'engagementSettings is required'
      });
    }

    // Get current settings and update only engagement settings
    const currentSettings = await databaseService.getUserSettings('user_default') || {
      id: 'default',
      xUserId: 'user_default',
      notificationSettings: {},
      engagementSettings: {},
      aiPreferences: {}
    };

    currentSettings.engagementSettings = engagementSettings;
    await databaseService.saveUserSettings(currentSettings);
    
    res.json({
      success: true,
      message: 'Engagement settings updated',
      data: currentSettings
    });
  } catch (error) {
    console.error('Error updating engagement settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update engagement settings'
    });
  }
});

// PUT /api/settings/ai - Update AI preferences
router.put('/ai', async (req, res) => {
  try {
    const { aiPreferences } = req.body;
    
    if (!aiPreferences) {
      return res.status(400).json({
        success: false,
        error: 'aiPreferences is required'
      });
    }

    // Get current settings and update only AI preferences
    const currentSettings = await databaseService.getUserSettings('user_default') || {
      id: 'default',
      xUserId: 'user_default',
      notificationSettings: {},
      engagementSettings: {},
      aiPreferences: {}
    };

    currentSettings.aiPreferences = aiPreferences;
    await databaseService.saveUserSettings(currentSettings);
    
    res.json({
      success: true,
      message: 'AI preferences updated',
      data: currentSettings
    });
  } catch (error) {
    console.error('Error updating AI preferences:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update AI preferences'
    });
  }
});

export default router;
