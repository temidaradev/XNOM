import express from 'express';
import { AuthService } from '../services/AuthService';
import { User, JWTPayload } from '../types';

const router = express.Router();

let authService: AuthService;

export const setAuthService = (service: AuthService) => {
  authService = service;
};

// Middleware to check if auth service is initialized
const requireAuthService = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!authService) {
    return res.status(500).json({ success: false, error: 'Auth service not initialized' });
  }
  next();
};

// GET /auth/twitter - Start Twitter OAuth flow
router.get('/twitter', requireAuthService, (req, res, next) => {
  console.log('🔐 Starting Twitter OAuth flow...');
  authService.getPassportInstance().authenticate('twitter')(req, res, next);
});

// GET /auth/twitter/callback - Twitter OAuth callback
router.get('/twitter/callback', 
  requireAuthService,
  (req, res, next) => {
    authService.getPassportInstance().authenticate('twitter', { 
      failureRedirect: '/auth/failure' 
    })(req, res, next);
  },
  async (req, res) => {
    try {
      console.log('✅ Twitter OAuth callback successful');
      const user = req.user as User;
      
      if (!user) {
        throw new Error('No user data received from Twitter');
      }

      // Generate JWT token
      const token = authService.generateJWT(user);
      
      // Redirect to frontend with token
      const redirectUrl = process.env.NODE_ENV === 'production'
        ? `https://yourdomain.com/auth/success?token=${token}`
        : `http://localhost:3000/auth/success?token=${token}`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      res.redirect('/auth/failure');
    }
  }
);

// GET /auth/failure - OAuth failure page
router.get('/failure', (req, res) => {
  res.status(401).json({
    success: false,
    error: 'Authentication failed. Please try again.',
    message: 'Unable to authenticate with X (Twitter). Please check your permissions and try again.'
  });
});

// GET /auth/success - OAuth success page (handled by frontend)
router.get('/success', (req, res) => {
  // This will be handled by the frontend, but provide a fallback
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>XNOM - Authentication Successful</title>
      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          display: flex; 
          justify-content: center; 
          align-items: center; 
          height: 100vh; 
          margin: 0; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .container { 
          text-align: center; 
          background: rgba(255,255,255,0.1); 
          padding: 2rem; 
          border-radius: 10px; 
          backdrop-filter: blur(10px);
        }
        .spinner { 
          border: 4px solid #f3f3f3; 
          border-top: 4px solid #3498db; 
          border-radius: 50%; 
          width: 40px; 
          height: 40px; 
          animation: spin 2s linear infinite; 
          margin: 20px auto;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎉 Authentication Successful!</h1>
        <div class="spinner"></div>
        <p>Redirecting you to XNOM...</p>
        <p><small>If you're not redirected automatically, <a href="/" style="color: #fff;">click here</a></small></p>
      </div>
      <script>
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');
        if (token) {
          localStorage.setItem('xnom_auth_token', token);
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      </script>
    </body>
    </html>
  `);
});

// POST /auth/logout - Logout user
router.post('/logout', requireAuthService, (req, res, next) => {
  authService.requireAuth(req, res, next);
}, async (req, res) => {
  try {
    const userToken = req.user as JWTPayload;
    
    if (userToken) {
      console.log(`🚪 User ${userToken.username} logged out`);
    }
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to logout'
    });
  }
});

// GET /auth/profile - Get current user profile
router.get('/profile', requireAuthService, (req, res, next) => {
  authService.requireAuth(req, res, next);
}, async (req, res) => {
  try {
    const userToken = req.user as JWTPayload;
    
    if (!userToken) {
      return res.status(401).json({
        success: false,
        error: 'No user token found'
      });
    }

    const user = await authService.getUserById(userToken.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't send sensitive tokens in response
    const publicUser = {
      id: user.id,
      userId: user.userId,
      xUserId: user.xUserId,
      username: user.username,
      displayName: user.displayName,
      profileImageUrl: user.profileImageUrl,
      createdAt: user.createdAt
    };

    res.json({
      success: true,
      data: publicUser
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile'
    });
  }
});

// GET /auth/verify - Verify token validity
router.get('/verify', requireAuthService, (req, res, next) => {
  authService.requireAuth(req, res, next);
}, (req, res) => {
  const user = req.user as JWTPayload;
  
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }

  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      userId: user.userId,
      username: user.username,
      xUserId: user.xUserId,
      authMethod: 'oauth' // All users via this flow are OAuth users
    }
  });
});

// GET /auth/status - Get authentication status (no auth required)
router.get('/status', requireAuthService, (req, res, next) => {
  authService.optionalAuth(req, res, next);
}, (req, res) => {
  const user = req.user as JWTPayload;
  
  if (user) {
    res.json({
      authenticated: true,
      user: {
        userId: user.userId,
        username: user.username,
        xUserId: user.xUserId
      }
    });
  } else {
    res.json({
      authenticated: false,
      message: 'Not authenticated'
    });
  }
});

export default router;
