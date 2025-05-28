# XNOM - X Notification Manager

A powerful TypeScript/Node.js application that intelligently manages X (Twitter) notifications, analyzes post ideas with AI, and automates engagement on high-performing content. Features a modern web interface for real-time monitoring and control.

## 🚀 Features

### Core Functionality

- **🔔 Real-time Notification Monitoring**: Track X notifications with WebSocket updates
- **🤖 AI-Powered Post Analysis**: Analyze post ideas and engagement potential using OpenAI
- **⚡ Auto-Engagement**: Automatically like high-performing tweets with robust retry logic
- **📊 Analytics Dashboard**: Real-time stats and engagement tracking
- **🎨 Modern Web Interface**: Clean, responsive dashboard with dark theme

### AI Integration

- **📝 Post Idea Analysis**: Score content 1-10 with detailed AI feedback
- **🎯 Content Generation**: Generate post ideas based on topics
- **🧠 Smart Engagement**: AI-powered decision making for engagement actions
- **💬 Reply Generation**: Context-aware automated responses

### Robust X API Integration

- **🔄 Retry Logic**: Advanced retry mechanism for failed likes (fixes common Twitter API issues)
- **⏱️ Rate Limiting**: Intelligent rate limit handling with usage tracking
- **🎯 High Engagement Detection**: Automatically find trending content worth engaging with
- **📈 Engagement Metrics**: Track all actions with success/failure analytics

## 🛠️ Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: SQLite with optimized schema
- **Real-time**: WebSocket for live updates
- **AI**: OpenAI API (GPT-3.5-turbo)
- **Social**: X (Twitter) API v2
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- X (Twitter) API credentials (Bearer Token, API Keys)
- OpenAI API key

## 🔧 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd xnom
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   Edit `.env` with your credentials:

   ```env
   # X API Credentials
   X_BEARER_TOKEN=your_bearer_token
   X_API_KEY=your_api_key
   X_API_SECRET=your_api_secret
   X_ACCESS_TOKEN=your_access_token
   X_ACCESS_TOKEN_SECRET=your_access_token_secret

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Application Settings
   NODE_ENV=development
   PORT=3000
   LOG_LEVEL=info

   # Feature Flags
   AUTO_ENGAGEMENT_ENABLED=true
   AI_ANALYSIS_ENABLED=true

   # Rate Limiting
   MAX_LIKES_PER_HOUR=50
   HIGH_ENGAGEMENT_THRESHOLD=100
   ENGAGEMENT_DELAY_MS=2000
   ```

5. **Build the application**
   ```bash
   npm run build
   ```

## 🚀 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

### Watch Mode (recommended for development)

```bash
npm run dev:watch
```

The application will be available at `http://localhost:3000`

## 📖 Usage

### Dashboard

- **Real-time Stats**: View notification counts, engagement metrics, and success rates
- **System Status**: Monitor WebSocket connection and service health
- **Quick Actions**: Start/stop monitoring and engagement services

### Notifications Tab

- **Live Monitoring**: Real-time notification feed with WebSocket updates
- **Control Panel**: Start/stop notification monitoring
- **History Management**: View and clear notification history

### Engagement Tab

- **Auto-Engagement**: Enable automatic liking of high-engagement tweets
- **Manual Actions**: Manually like specific tweets by ID
- **Analytics**: View engagement history with success/failure tracking
- **Rate Limiting**: Monitor hourly limits and current usage

### Post Ideas Tab

- **AI Analysis**: Analyze your post ideas with detailed scoring (1-10)
- **Content Generation**: Generate post ideas based on topics
- **Approval Workflow**: Review, approve, or reject AI-generated content
- **Scheduling**: Schedule approved posts for future publication

### Settings Tab

- **Engagement Configuration**: Set thresholds and limits
- **AI Settings**: Enable/disable AI analysis features
- **Rate Limiting**: Configure hourly limits and delays
- **Monitoring**: Set notification monitoring intervals

## 🔧 API Endpoints

### Notifications

- `GET /api/notifications` - Get all notifications
- `POST /api/notifications/start` - Start monitoring
- `POST /api/notifications/stop` - Stop monitoring
- `DELETE /api/notifications` - Clear all notifications

### Engagement

- `GET /api/engagement/history` - Get engagement history
- `POST /api/engagement/start` - Start auto-engagement
- `POST /api/engagement/stop` - Stop auto-engagement
- `POST /api/engagement/like/:tweetId` - Manual like

### Post Ideas

- `GET /api/post-ideas` - Get all post ideas
- `POST /api/post-ideas/analyze` - Analyze post content
- `POST /api/post-ideas/generate` - Generate post ideas
- `PUT /api/post-ideas/:id/approve` - Approve post idea
- `DELETE /api/post-ideas/:id` - Delete post idea

### Settings

- `GET /api/settings` - Get user settings
- `PUT /api/settings` - Update settings

## 🗄️ Database Schema

### Core Tables

**notifications**

- `id` (TEXT PRIMARY KEY)
- `type` (TEXT)
- `content` (TEXT)
- `data` (TEXT JSON)
- `timestamp` (TEXT)

**engagement_actions**

- `id` (TEXT PRIMARY KEY)
- `type` (TEXT: 'like', 'retweet', 'reply')
- `tweet_id` (TEXT)
- `user_id` (TEXT)
- `success` (INTEGER BOOLEAN)
- `retry_count` (INTEGER)
- `error` (TEXT)
- `timestamp` (TEXT)

**post_ideas**

- `id` (TEXT PRIMARY KEY)
- `content` (TEXT)
- `ai_analysis` (TEXT)
- `score` (INTEGER 1-10)
- `category` (TEXT)
- `approved` (INTEGER BOOLEAN)
- `scheduled_for` (TEXT)
- `created_at` (TEXT)

**settings**

- `key` (TEXT PRIMARY KEY)
- `value` (TEXT JSON)

## 🔒 Security Features

- **Environment Variables**: All secrets stored in environment variables
- **Rate Limiting**: Built-in rate limiting to prevent abuse
- **Input Validation**: Comprehensive input sanitization
- **Error Handling**: Graceful error handling with user-friendly messages
- **CORS Configuration**: Proper CORS setup for frontend access

## 🐛 Troubleshooting

### Common Issues

**X API Like Failures**

- _Problem_: Likes fail silently or return unclear errors
- _Solution_: XNOM implements robust retry logic with exponential backoff (1s, 2s, 4s)
- _Monitoring_: Check engagement history for retry attempts and error details

**Rate Limiting**

- _Problem_: Hitting X API rate limits
- _Solution_: XNOM tracks usage and respects limits automatically
- _Configuration_: Adjust `MAX_LIKES_PER_HOUR` and `ENGAGEMENT_DELAY_MS` in settings

**Database Locks**

- _Problem_: SQLite database locked errors
- _Solution_: XNOM uses proper transaction handling and connection pooling
- _Recovery_: Restart the application if issues persist

**WebSocket Connection Issues**

- _Problem_: Real-time updates not working
- _Solution_: Check browser console for connection errors
- _Recovery_: Refresh the page to reconnect

### Debug Mode

Enable verbose logging:

```env
LOG_LEVEL=debug
```

### Logs Location

- Console output in development
- Check server logs for detailed error information

## 📊 Performance Optimization

### Database

- Optimized indexes for time-based queries
- Efficient pagination for large datasets
- Transaction batching for bulk operations

### API Usage

- Intelligent caching to reduce API calls
- Exponential backoff for rate limit handling
- Connection pooling for database operations

### Frontend

- WebSocket for real-time updates (no polling)
- Lazy loading for large data sets
- Efficient DOM updates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Add JSDoc comments for complex functions
- Implement comprehensive error handling
- Write meaningful commit messages
- Test thoroughly before submitting

## 📝 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## 🙋‍♂️ Support

For support, please open an issue on the GitHub repository or contact the development team.

## 🔮 Roadmap

### Upcoming Features

- [ ] Multi-account support
- [ ] Advanced analytics and reporting
- [ ] Mobile app development
- [ ] Integration with other social platforms
- [ ] Enhanced AI-powered content scheduling
- [ ] User authentication and multi-user support

### Technical Improvements

- [ ] Comprehensive test suite
- [ ] CI/CD pipeline setup
- [ ] Docker containerization
- [ ] Redis caching layer
- [ ] API documentation (Swagger)
- [ ] Performance monitoring

---

**XNOM** - Intelligent X Notification Management with AI 🚀
