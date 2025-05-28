import express from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { NotificationService } from '../services/NotificationService';

const router = express.Router();

// This will be injected by the main app
let notificationService: NotificationService;

export const setNotificationService = (service: NotificationService) => {
  notificationService = service;
};

// GET /api/notifications - Get notifications with pagination
router.get('/', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const type = req.query.type as string;
    const priority = req.query.priority as string;

    const notifications = await notificationService.getNotifications(limit, offset);
    
    // Filter by type and priority if specified
    let filteredNotifications = notifications;
    if (type) {
      filteredNotifications = filteredNotifications.filter(n => n.type === type);
    }
    if (priority) {
      filteredNotifications = filteredNotifications.filter(n => n.priority === priority);
    }

    res.json({
      success: true,
      data: filteredNotifications,
      pagination: {
        limit,
        offset,
        total: filteredNotifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications'
    });
  }
});

// GET /api/notifications/stats - Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await notificationService.getNotificationStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notification statistics'
    });
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    
    await notificationService.markNotificationAsRead(id);
    
    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
});

// POST /api/notifications/monitoring/start - Start notification monitoring
router.post('/monitoring/start', async (req, res) => {
  try {
    if (notificationService.isMonitoringActive()) {
      return res.json({
        success: true,
        message: 'Notification monitoring is already active'
      });
    }

    notificationService.startMonitoring();
    
    res.json({
      success: true,
      message: 'Notification monitoring started'
    });
  } catch (error) {
    console.error('Error starting notification monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start notification monitoring'
    });
  }
});

// POST /api/notifications/monitoring/stop - Stop notification monitoring
router.post('/monitoring/stop', async (req, res) => {
  try {
    notificationService.stopMonitoring();
    
    res.json({
      success: true,
      message: 'Notification monitoring stopped'
    });
  } catch (error) {
    console.error('Error stopping notification monitoring:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to stop notification monitoring'
    });
  }
});

// GET /api/notifications/monitoring/status - Get monitoring status
router.get('/monitoring/status', async (req, res) => {
  try {
    const isActive = notificationService.isMonitoringActive();
    
    res.json({
      success: true,
      data: {
        isMonitoring: isActive,
        status: isActive ? 'active' : 'inactive'
      }
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get monitoring status'
    });
  }
});

export default router;
