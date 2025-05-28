import express from 'express';
import { EngagementService } from '../services/EngagementService';

const router = express.Router();

let engagementService: EngagementService;

export const setEngagementService = (service: EngagementService) => {
  engagementService = service;
};

// GET /api/engagement/stats - Get engagement statistics
router.get('/stats', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours as string) || 24;
    const stats = await engagementService.getEngagementStats(hours);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching engagement stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch engagement statistics'
    });
  }
});

// POST /api/engagement/like/:tweetId - Manually like a specific tweet
router.post('/like/:tweetId', async (req, res) => {
  try {
    const { tweetId } = req.params;
    
    const result = await engagementService.likeSpecificTweet(tweetId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Tweet liked successfully',
        data: { tweetId }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to like tweet'
      });
    }
  } catch (error) {
    console.error('Error liking tweet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to like tweet'
    });
  }
});

// POST /api/engagement/auto/start - Start auto-engagement
router.post('/auto/start', async (req, res) => {
  try {
    if (engagementService.isAutoEngagementRunning()) {
      return res.json({
        success: true,
        message: 'Auto-engagement is already active'
      });
    }

    engagementService.startAutoEngagement();
    
    res.json({
      success: true,
      message: 'Auto-engagement started'
    });
  } catch (error) {
    console.error('Error starting auto-engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start auto-engagement'
    });
  }
});

// POST /api/engagement/auto/stop - Stop auto-engagement
router.post('/auto/stop', async (req, res) => {
  try {
    engagementService.stopAutoEngagement();
    
    res.json({
      success: true,
      message: 'Auto-engagement stopped'
    });
  } catch (error) {
    console.error('Error stopping auto-engagement:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop auto-engagement'
    });
  }
});

// GET /api/engagement/auto/status - Get auto-engagement status
router.get('/auto/status', async (req, res) => {
  try {
    const isActive = engagementService.isAutoEngagementRunning();
    
    res.json({
      success: true,
      data: {
        isAutoEngagementActive: isActive,
        status: isActive ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error getting auto-engagement status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get auto-engagement status'
    });
  }
});

export default router;
