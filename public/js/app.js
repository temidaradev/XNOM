// XNOM Frontend Application
class XNOMApp {
    constructor() {
        this.ws = null;
        this.currentTab = 'dashboard';
        this.isConnected = false;
        this.isAuthenticated = false;
        this.authToken = null;
        this.user = null;
        this.stats = {
            totalNotifications: 0,
            totalEngagements: 0,
            totalPostIdeas: 0,
            successRate: 0
        };
        
        this.init();
    }

    async init() {
        // Check authentication first
        await this.checkAuthentication();
        
        if (!this.isAuthenticated) {
            this.showLoginPage();
            return;
        }
        
        this.showUserProfile();
        this.setupOAuthRestrictions(); // Apply OAuth user restrictions
        await this.setupWebSocket();
        this.setupEventListeners();
        this.setupTabNavigation();
        await this.loadInitialData();
        this.showTab('dashboard');
    }

    async checkAuthentication() {
        // Check for token in localStorage (from OAuth redirect)
        this.authToken = localStorage.getItem('xnom_auth_token');
        
        if (!this.authToken) {
            // Check URL params for token (OAuth callback)
            const urlParams = new URLSearchParams(window.location.search);
            const tokenFromUrl = urlParams.get('token');
            if (tokenFromUrl) {
                this.authToken = tokenFromUrl;
                localStorage.setItem('xnom_auth_token', tokenFromUrl);
                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }
        
        if (this.authToken) {
            try {
                const response = await fetch('/auth/verify', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.authToken}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.isAuthenticated = true;
                    this.user = result.user;
                    console.log('✅ User authenticated:', this.user);
                } else {
                    // Invalid token, remove it
                    localStorage.removeItem('xnom_auth_token');
                    this.authToken = null;
                }
            } catch (error) {
                console.error('Authentication check failed:', error);
                localStorage.removeItem('xnom_auth_token');
                this.authToken = null;
            }
        }
    }

    showLoginPage() {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('main-app').style.display = 'none';
        
        // Create login page
        const loginPage = document.createElement('div');
        loginPage.id = 'login-page';
        loginPage.className = 'login-page';
        loginPage.innerHTML = `
            <div class="login-container">
                <div class="login-card">
                    <div class="login-header">
                        <h1><i class="fab fa-x-twitter"></i> XNOM</h1>
                        <h2>X Notification Manager</h2>
                        <p>Sign in with your X (Twitter) account to access notifications</p>
                    </div>
                    <div class="login-content">
                        <a href="/auth/twitter" class="x-login-btn">
                            <i class="fab fa-x-twitter"></i>
                            Sign in with X
                        </a>
                        <div class="login-info">
                            <h3>🔔 Access Your Notifications</h3>
                            <p>With X OAuth authentication, you can:</p>
                            <ul>
                                <li>✅ View your X notifications in real-time</li>
                                <li>✅ Monitor mentions, replies, and interactions</li>
                                <li>✅ Get organized notification management</li>
                                <li>🔒 Secure access with your X credentials</li>
                            </ul>
                            <div class="access-note">
                                <p><strong>Note:</strong> X OAuth users have access only to notification features for security.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(loginPage);
    }

    setupWebSocket() {
        return new Promise((resolve) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.isConnected = true;
                this.updateConnectionStatus(true);
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                
                // Attempt to reconnect after 5 seconds
                setTimeout(() => {
                    if (!this.isConnected) {
                        this.setupWebSocket();
                    }
                }, 5000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
                resolve(); // Still resolve to continue initialization
            };
        });
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'notification':
                this.addNotificationToUI(data.data);
                this.updateStats();
                break;
            case 'engagement':
                this.updateEngagementUI(data.data);
                this.updateStats();
                break;
            case 'stats':
                this.updateStatsUI(data.data);
                break;
            default:
                console.log('Unknown WebSocket message type:', data.type);
        }
    }

    updateConnectionStatus(connected) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = connected ? 'Connected' : 'Disconnected';
            statusElement.className = `status ${connected ? 'connected' : 'disconnected'}`;
        }
    }

    // Helper method for authenticated API calls
    async makeAuthenticatedRequest(url, options = {}) {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.authToken}`
            }
        };

        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...(options.headers || {})
            }
        };

        try {
            const response = await fetch(url, mergedOptions);
            
            if (response.status === 401) {
                // Token is invalid, redirect to login
                this.logout();
                return null;
            }
            
            if (response.status === 403) {
                // Access denied - show restricted access message
                const result = await response.json();
                this.showAccessDeniedMessage(result.message || 'Access denied to this feature');
                return null;
            }
            
            return response;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    showAccessDeniedMessage(message) {
        // Show a toast or modal with the access denied message
        const toast = document.createElement('div');
        toast.className = 'access-denied-toast';
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-lock"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    logout() {
        localStorage.removeItem('xnom_auth_token');
        this.authToken = null;
        this.isAuthenticated = false;
        this.user = null;
        window.location.reload();
    }

    showUserProfile() {
        if (this.user) {
            const userProfile = document.getElementById('user-profile');
            const avatarText = document.getElementById('user-avatar-text');
            const userName = document.getElementById('user-name');
            const userHandle = document.getElementById('user-handle');
            
            if (userProfile && userName && userHandle && avatarText) {
                avatarText.textContent = this.user.username.charAt(0).toUpperCase();
                userName.textContent = this.user.username;
                userHandle.textContent = `@${this.user.username}`;
                userProfile.style.display = 'flex';
            }
        }
    }

    setupOAuthRestrictions() {
        if (this.user && this.user.authMethod === 'oauth') {
            // Hide non-notification tabs for OAuth users
            const restrictedTabs = ['engagement', 'post-ideas', 'settings'];
            
            restrictedTabs.forEach(tabId => {
                const tabButton = document.querySelector(`[data-tab="${tabId}"]`);
                if (tabButton) {
                    tabButton.style.display = 'none';
                }
            });

            // Hide restricted quick actions on dashboard
            const restrictedActions = ['toggle-engagement', 'generate-ideas'];
            restrictedActions.forEach(actionId => {
                const actionBtn = document.getElementById(actionId);
                if (actionBtn) {
                    actionBtn.style.display = 'none';
                }
            });

            // Add OAuth restriction indicator
            const header = document.querySelector('.main-header h1');
            if (header) {
                const restrictionBadge = document.createElement('span');
                restrictionBadge.className = 'oauth-restriction-badge';
                restrictionBadge.innerHTML = '<i class="fas fa-lock"></i> Notifications Only';
                restrictionBadge.title = 'OAuth users have access to notifications only';
                header.appendChild(restrictionBadge);
            }

            console.log('🔒 OAuth restrictions applied - notifications access only');
        }
    }

    setupEventListeners() {
        // Notification management
        document.getElementById('start-monitoring')?.addEventListener('click', () => {
            this.startNotificationMonitoring();
        });
        
        document.getElementById('stop-monitoring')?.addEventListener('click', () => {
            this.stopNotificationMonitoring();
        });
        
        document.getElementById('clear-notifications')?.addEventListener('click', () => {
            this.clearNotifications();
        });

        // Engagement actions
        document.getElementById('start-engagement')?.addEventListener('click', () => {
            this.startAutoEngagement();
        });
        
        document.getElementById('stop-engagement')?.addEventListener('click', () => {
            this.stopAutoEngagement();
        });

        // Post idea analysis
        document.getElementById('analyze-post-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.analyzePostIdea();
        });

        // Post idea generation
        document.getElementById('generate-posts-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.generatePostIdeas();
        });

        // Settings
        document.getElementById('save-settings')?.addEventListener('click', () => {
            this.saveSettings();
        });

        // Refresh buttons
        document.getElementById('refresh-notifications')?.addEventListener('click', () => {
            this.loadNotifications();
        });
        
        document.getElementById('refresh-engagement')?.addEventListener('click', () => {
            this.loadEngagementHistory();
        });
        
        document.getElementById('refresh-post-ideas')?.addEventListener('click', () => {
            this.loadPostIdeas();
        });

        // Logout button
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.logout();
        });
    }

    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                this.showTab(tabId);
            });
        });
    }

    showTab(tabId) {
        // Check if OAuth user is trying to access restricted tab
        if (this.user && this.user.authMethod === 'oauth') {
            const restrictedTabs = ['engagement', 'post-ideas', 'settings'];
            if (restrictedTabs.includes(tabId)) {
                this.showAccessDeniedMessage('OAuth users have access to notifications only');
                return;
            }
        }

        // Hide all tab contents
        const tabContents = document.querySelectorAll('.tab-content');
        tabContents.forEach(content => {
            content.classList.remove('active');
        });

        // Remove active class from all tab buttons
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.classList.remove('active');
        });

        // Show selected tab content
        const selectedTab = document.getElementById(`${tabId}-tab`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }

        // Add active class to selected tab button
        const selectedButton = document.querySelector(`[data-tab="${tabId}"]`);
        if (selectedButton) {
            selectedButton.classList.add('active');
        }

        this.currentTab = tabId;

        // Load tab-specific data
        switch (tabId) {
            case 'dashboard':
                this.updateStats();
                break;
            case 'notifications':
                this.loadNotifications();
                break;
            case 'engagement':
                this.loadEngagementHistory();
                break;
            case 'post-ideas':
                this.loadPostIdeas();
                break;
            case 'settings':
                this.loadSettings();
                break;
        }
    }

    async loadInitialData() {
        if (this.user && this.user.authMethod === 'oauth') {
            // OAuth users only get notifications
            await this.updateStats();
        } else {
            // Full access users get all data
            await Promise.all([
                this.updateStats(),
                this.loadSettings()
            ]);
        }
    }

    // Legacy API method - now using authenticated requests
    async apiCall(endpoint, options = {}) {
        const response = await this.makeAuthenticatedRequest(`/api${endpoint}`, options);
        
        if (!response) {
            throw new Error('Request failed or access denied');
        }
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}`);
        }

        return data;
    }

    // Dashboard Methods
    async updateStats() {
        try {
            if (this.user && this.user.authMethod === 'oauth') {
                // OAuth users can only see notification stats
                const notifications = await this.apiCall('/notifications');
                this.stats = {
                    totalNotifications: notifications.data?.length || 0,
                    totalEngagements: 'N/A',
                    totalPostIdeas: 'N/A',
                    successRate: 'N/A'
                };
            } else {
                // Full access users can see all stats
                const [notifications, engagements, postIdeas] = await Promise.all([
                    this.apiCall('/notifications'),
                    this.apiCall('/engagement/history'),
                    this.apiCall('/post-ideas')
                ]);

                this.stats = {
                    totalNotifications: notifications.data?.length || 0,
                    totalEngagements: engagements.data?.length || 0,
                    totalPostIdeas: postIdeas.data?.length || 0,
                    successRate: this.calculateSuccessRate(engagements.data || [])
                };
            }

            this.updateStatsUI(this.stats);
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    calculateSuccessRate(engagements) {
        if (engagements.length === 0) return 0;
        const successful = engagements.filter(e => e.success).length;
        return Math.round((successful / engagements.length) * 100);
    }

    updateStatsUI(stats) {
        document.getElementById('total-notifications').textContent = stats.totalNotifications;
        document.getElementById('total-engagements').textContent = stats.totalEngagements;
        document.getElementById('total-post-ideas').textContent = stats.totalPostIdeas;
        document.getElementById('success-rate').textContent = `${stats.successRate}%`;
    }

    // Notification Methods
    async loadNotifications() {
        try {
            const response = await this.apiCall('/notifications');
            this.displayNotifications(response.data || []);
        } catch (error) {
            console.error('Error loading notifications:', error);
        }
    }

    displayNotifications(notifications) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        if (notifications.length === 0) {
            container.innerHTML = '<div class="empty-state">No notifications found</div>';
            return;
        }

        container.innerHTML = notifications.map(notification => `
            <div class="notification-item ${notification.type}">
                <div class="notification-header">
                    <span class="notification-type">${notification.type}</span>
                    <span class="notification-time">${new Date(notification.timestamp).toLocaleString()}</span>
                </div>
                <div class="notification-content">${notification.content}</div>
                ${notification.data ? `<div class="notification-data">${JSON.stringify(notification.data, null, 2)}</div>` : ''}
            </div>
        `).join('');
    }

    addNotificationToUI(notification) {
        const container = document.getElementById('notifications-list');
        if (!container) return;

        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item ${notification.type}`;
        notificationElement.innerHTML = `
            <div class="notification-header">
                <span class="notification-type">${notification.type}</span>
                <span class="notification-time">${new Date(notification.timestamp).toLocaleString()}</span>
            </div>
            <div class="notification-content">${notification.content}</div>
            ${notification.data ? `<div class="notification-data">${JSON.stringify(notification.data, null, 2)}</div>` : ''}
        `;

        container.insertBefore(notificationElement, container.firstChild);
    }

    async startNotificationMonitoring() {
        try {
            await this.apiCall('/notifications/monitoring/start', { method: 'POST' });
            this.showSuccess('Notification monitoring started');
        } catch (error) {
            console.error('Error starting monitoring:', error);
        }
    }

    async stopNotificationMonitoring() {
        try {
            await this.apiCall('/notifications/monitoring/stop', { method: 'POST' });
            this.showSuccess('Notification monitoring stopped');
        } catch (error) {
            console.error('Error stopping monitoring:', error);
        }
    }

    async clearNotifications() {
        if (!confirm('Are you sure you want to clear all notifications?')) return;
        
        try {
            await this.apiCall('/notifications', { method: 'DELETE' });
            this.loadNotifications();
            this.showSuccess('Notifications cleared');
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    }

    // Engagement Methods
    async loadEngagementHistory() {
        try {
            const response = await this.apiCall('/engagement/history');
            this.displayEngagementHistory(response.data || []);
        } catch (error) {
            console.error('Error loading engagement history:', error);
        }
    }

    displayEngagementHistory(engagements) {
        const container = document.getElementById('engagement-history');
        if (!container) return;

        if (engagements.length === 0) {
            container.innerHTML = '<div class="empty-state">No engagement history found</div>';
            return;
        }

        container.innerHTML = engagements.map(engagement => `
            <div class="engagement-item ${engagement.success ? 'success' : 'failed'}">
                <div class="engagement-header">
                    <span class="engagement-action">${engagement.action}</span>
                    <span class="engagement-status ${engagement.success ? 'success' : 'failed'}">
                        ${engagement.success ? '✓' : '✗'}
                    </span>
                    <span class="engagement-time">${new Date(engagement.timestamp).toLocaleString()}</span>
                </div>
                <div class="engagement-tweet-id">Tweet: ${engagement.tweetId}</div>
                ${engagement.error ? `<div class="engagement-error">${engagement.error}</div>` : ''}
            </div>
        `).join('');
    }

    updateEngagementUI(engagement) {
        const container = document.getElementById('engagement-history');
        if (!container) return;

        const engagementElement = document.createElement('div');
        engagementElement.className = `engagement-item ${engagement.success ? 'success' : 'failed'}`;
        engagementElement.innerHTML = `
            <div class="engagement-header">
                <span class="engagement-action">${engagement.action}</span>
                <span class="engagement-status ${engagement.success ? 'success' : 'failed'}">
                    ${engagement.success ? '✓' : '✗'}
                </span>
                <span class="engagement-time">${new Date(engagement.timestamp).toLocaleString()}</span>
            </div>
            <div class="engagement-tweet-id">Tweet: ${engagement.tweetId}</div>
            ${engagement.error ? `<div class="engagement-error">${engagement.error}</div>` : ''}
        `;

        container.insertBefore(engagementElement, container.firstChild);
    }

    async startAutoEngagement() {
        try {
            await this.apiCall('/engagement/start', { method: 'POST' });
            this.showSuccess('Auto-engagement started');
        } catch (error) {
            console.error('Error starting auto-engagement:', error);
        }
    }

    async stopAutoEngagement() {
        try {
            await this.apiCall('/engagement/stop', { method: 'POST' });
            this.showSuccess('Auto-engagement stopped');
        } catch (error) {
            console.error('Error stopping auto-engagement:', error);
        }
    }

    // Post Ideas Methods
    async loadPostIdeas() {
        try {
            const response = await this.apiCall('/post-ideas');
            this.displayPostIdeas(response.data || []);
        } catch (error) {
            console.error('Error loading post ideas:', error);
        }
    }

    displayPostIdeas(postIdeas) {
        const container = document.getElementById('post-ideas-list');
        if (!container) return;

        if (postIdeas.length === 0) {
            container.innerHTML = '<div class="empty-state">No post ideas found</div>';
            return;
        }

        container.innerHTML = postIdeas.map(idea => `
            <div class="post-idea-item ${idea.approved ? 'approved' : 'pending'}">
                <div class="post-idea-header">
                    <span class="post-idea-score">Score: ${idea.score}/10</span>
                    <span class="post-idea-category">${idea.category}</span>
                    <span class="post-idea-status ${idea.approved ? 'approved' : 'pending'}">
                        ${idea.approved ? 'Approved' : 'Pending'}
                    </span>
                </div>
                <div class="post-idea-content">${idea.content}</div>
                <div class="post-idea-analysis">${idea.aiAnalysis}</div>
                <div class="post-idea-actions">
                    ${!idea.approved ? `
                        <button onclick="app.approvePostIdea('${idea.id}')" class="btn btn-success">Approve</button>
                        <button onclick="app.rejectPostIdea('${idea.id}')" class="btn btn-danger">Reject</button>
                    ` : ''}
                    <button onclick="app.deletePostIdea('${idea.id}')" class="btn btn-danger">Delete</button>
                    ${idea.approved ? `
                        <button onclick="app.schedulePostIdea('${idea.id}')" class="btn btn-primary">Schedule</button>
                    ` : ''}
                </div>
                <div class="post-idea-footer">
                    <span class="post-idea-time">Created: ${new Date(idea.createdAt).toLocaleString()}</span>
                    ${idea.scheduledFor ? `<span class="post-idea-scheduled">Scheduled: ${new Date(idea.scheduledFor).toLocaleString()}</span>` : ''}
                </div>
            </div>
        `).join('');
    }

    async analyzePostIdea() {
        const content = document.getElementById('post-content').value;
        if (!content.trim()) {
            this.showError('Please enter post content');
            return;
        }

        try {
            const button = document.getElementById('analyze-btn');
            button.disabled = true;
            button.textContent = 'Analyzing...';

            const response = await this.apiCall('/post-ideas/analyze', {
                method: 'POST',
                body: JSON.stringify({ content })
            });

            document.getElementById('post-content').value = '';
            this.loadPostIdeas();
            this.showSuccess('Post idea analyzed successfully');
        } catch (error) {
            console.error('Error analyzing post idea:', error);
        } finally {
            const button = document.getElementById('analyze-btn');
            button.disabled = false;
            button.textContent = 'Analyze';
        }
    }

    async generatePostIdeas() {
        const topic = document.getElementById('generation-topic').value;
        const count = parseInt(document.getElementById('generation-count').value) || 5;

        if (!topic.trim()) {
            this.showError('Please enter a topic');
            return;
        }

        try {
            const button = document.getElementById('generate-btn');
            button.disabled = true;
            button.textContent = 'Generating...';

            const response = await this.apiCall('/post-ideas/generate', {
                method: 'POST',
                body: JSON.stringify({ topic, count })
            });

            document.getElementById('generation-topic').value = '';
            document.getElementById('generation-count').value = '5';
            this.loadPostIdeas();
            this.showSuccess(`Generated ${response.data.length} post ideas`);
        } catch (error) {
            console.error('Error generating post ideas:', error);
        } finally {
            const button = document.getElementById('generate-btn');
            button.disabled = false;
            button.textContent = 'Generate';
        }
    }

    async approvePostIdea(id) {
        try {
            await this.apiCall(`/post-ideas/${id}/approve`, { method: 'PUT' });
            this.loadPostIdeas();
            this.showSuccess('Post idea approved');
        } catch (error) {
            console.error('Error approving post idea:', error);
        }
    }

    async rejectPostIdea(id) {
        try {
            await this.apiCall(`/post-ideas/${id}/reject`, { method: 'PUT' });
            this.loadPostIdeas();
            this.showSuccess('Post idea rejected');
        } catch (error) {
            console.error('Error rejecting post idea:', error);
        }
    }

    async deletePostIdea(id) {
        if (!confirm('Are you sure you want to delete this post idea?')) return;

        try {
            await this.apiCall(`/post-ideas/${id}`, { method: 'DELETE' });
            this.loadPostIdeas();
            this.showSuccess('Post idea deleted');
        } catch (error) {
            console.error('Error deleting post idea:', error);
        }
    }

    async schedulePostIdea(id) {
        const scheduledFor = prompt('Enter schedule date (YYYY-MM-DD HH:MM):');
        if (!scheduledFor) return;

        try {
            await this.apiCall(`/post-ideas/${id}/schedule`, {
                method: 'PUT',
                body: JSON.stringify({ scheduledFor })
            });
            this.loadPostIdeas();
            this.showSuccess('Post idea scheduled');
        } catch (error) {
            console.error('Error scheduling post idea:', error);
        }
    }

    // Settings Methods
    async loadSettings() {
        try {
            const response = await this.apiCall('/settings');
            this.displaySettings(response.data || {});
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    displaySettings(settings) {
        document.getElementById('engagement-enabled').checked = settings.autoEngagementEnabled || false;
        document.getElementById('like-threshold').value = settings.likeThreshold || 10;
        document.getElementById('retweet-threshold').value = settings.retweetThreshold || 20;
        document.getElementById('reply-threshold').value = settings.replyThreshold || 30;
        document.getElementById('monitoring-interval').value = settings.monitoringInterval || 60;
        document.getElementById('max-likes-per-hour').value = settings.maxLikesPerHour || 50;
        document.getElementById('ai-analysis-enabled').checked = settings.aiAnalysisEnabled || true;
    }

    async saveSettings() {
        const settings = {
            autoEngagementEnabled: document.getElementById('engagement-enabled').checked,
            likeThreshold: parseInt(document.getElementById('like-threshold').value),
            retweetThreshold: parseInt(document.getElementById('retweet-threshold').value),
            replyThreshold: parseInt(document.getElementById('reply-threshold').value),
            monitoringInterval: parseInt(document.getElementById('monitoring-interval').value),
            maxLikesPerHour: parseInt(document.getElementById('max-likes-per-hour').value),
            aiAnalysisEnabled: document.getElementById('ai-analysis-enabled').checked
        };

        try {
            await this.apiCall('/settings', {
                method: 'PUT',
                body: JSON.stringify(settings)
            });
            this.showSuccess('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }

    // Utility Methods
    showSuccess(message) {
        this.showMessage(message, 'success');
    }

    showError(message) {
        this.showMessage(message, 'error');
    }

    showMessage(message, type) {
        const container = document.getElementById('message-container') || document.body;
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;

        container.appendChild(messageElement);

        setTimeout(() => {
            messageElement.remove();
        }, 5000);
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new XNOMApp();
});
