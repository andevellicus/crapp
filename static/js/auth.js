// Add to static/js/auth.js

// Token management enhancements
class AuthManager {
    constructor() {
        this.refreshPromise = null;
        this.refreshTimeout = null;
        this.tokenRefreshThreshold = 60000; // 60 seconds before expiry
        this.refreshAuthState();
    }

    updateHeader() {
        // This will update the header based on authentication status
        const userMenu = document.getElementById('user-menu');
        const guestNav = document.getElementById('guest-nav');
        const userName = document.getElementById('user-name');
        const adminLinks = document.getElementById('admin-links');
        
        if (this.isAuthenticated()) {
            // User is logged in
            if (userMenu) userMenu.style.display = 'block';
            if (guestNav) guestNav.style.display = 'none';
            
            // Update user name
            if (userName && this.currentUser) {
                userName.textContent = this.currentUser.first_name || this.currentUser.email;
            }
            
            // Show admin links if user is admin
            if (adminLinks && this.currentUser && this.currentUser.is_admin) {
                adminLinks.style.display = 'inline';
            }
        } else {
            // User is not logged in
            if (userMenu) userMenu.style.display = 'none';
            if (guestNav) guestNav.style.display = 'flex';
            
            // Hide admin links
            if (adminLinks) {
                adminLinks.style.display = 'none';
            }
        }
    }
    
    refreshAuthState() {
        this.accessToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
        this.refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
        this.tokenExpiry = parseInt(localStorage.getItem('tokenExpiry') || sessionStorage.getItem('tokenExpiry') || '0');
        this.currentUser = this.getUserFromStorage();
        this.deviceId = localStorage.getItem('deviceId') || sessionStorage.getItem('deviceId');
        
        // Set up token refresh if needed
        this.scheduleTokenRefresh();
        
        // Update UI based on auth state
        this.updateHeader();
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.accessToken && 
        this.tokenExpiry && 
        Date.now() < this.tokenExpiry;
    }
    
    // Get current user
    getCurrentUser() {
        return this.currentUser;
      }
    
    getUserFromStorage() {
        const userJSON = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        return userJSON ? JSON.parse(userJSON) : null;
    }

    // Get device info for device registration
    getDeviceInfo() {
        return {
            device_name: this.detectDeviceName(),
            device_type: this.detectDeviceType(),
            user_agent: navigator.userAgent,
            os: this.detectOS(),
            screen_size: {
                width: window.screen.width,
                height: window.screen.height
            }
        };
    }

    getDeviceId() {
        return this.deviceId || localStorage.getItem('deviceId') || sessionStorage.getItem('deviceId');
      }
    
    // Generate a user-friendly device name
    detectDeviceName() {
        const deviceType = this.detectDeviceType();
        const os = this.detectOS();
        const browser = this.detectBrowser();
        
        return `${os} ${deviceType} (${browser})`;
    }

        // Detect device type
        detectDeviceType() {
            const ua = navigator.userAgent;
            if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
                return 'Tablet';
            }
            if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated/.test(ua)) {
                return 'Mobile';
            }
            return 'Desktop';
        }
        
        // Detect OS
        detectOS() {
            const userAgent = window.navigator.userAgent;
            const platform = window.navigator.platform;
            const macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'];
            const windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'];
            const iosPlatforms = ['iPhone', 'iPad', 'iPod'];
            
            if (macosPlatforms.indexOf(platform) !== -1) {
                return 'macOS';
            } else if (iosPlatforms.indexOf(platform) !== -1) {
                return 'iOS';
            } else if (windowsPlatforms.indexOf(platform) !== -1) {
                return 'Windows';
            } else if (/Android/.test(userAgent)) {
                return 'Android';
            } else if (/Linux/.test(platform)) {
                return 'Linux';
            }
            
            return 'Unknown';
        }
        
        // Detect browser
        detectBrowser() {
            const userAgent = navigator.userAgent;
            
            if (userAgent.indexOf("Firefox") > -1) {
                return "Firefox";
            } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
                return "Opera";
            } else if (userAgent.indexOf("Trident") > -1) {
                return "Internet Explorer";
            } else if (userAgent.indexOf("Edge") > -1) {
                return "Edge";
            } else if (userAgent.indexOf("Chrome") > -1) {
                return "Chrome";
            } else if (userAgent.indexOf("Safari") > -1) {
                return "Safari";
            } else {
                return "Unknown";
            }
        }
    
    // Enhanced login function with token pair support
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email, 
                    password,
                    device_info: this.getDeviceInfo()
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Login failed');
            }
            
            const data = await response.json();
            
            // Store auth data
            const storage = rememberMe ? localStorage : sessionStorage;
            
            // Store tokens
            storage.setItem('accessToken', data.access_token);
            storage.setItem('refreshToken', data.refresh_token);
            
            // Calculate and store token expiry time
            const expiryTime = Date.now() + (data.expires_in * 1000);
            storage.setItem('tokenExpiry', expiryTime.toString());
            
            // Store user data and device ID
            storage.setItem('currentUser', JSON.stringify(data.user));
            storage.setItem('deviceId', data.device_id);
            
            // Update internal state
            this.accessToken = data.access_token;
            this.refreshToken = data.refresh_token;
            this.tokenExpiry = expiryTime;
            this.currentUser = data.user;
            this.deviceId = data.device_id;
            
            // Schedule token refresh
            this.scheduleTokenRefresh();
            
            // Update UI
            this.updateHeader();
            
            return data.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    
    // Logout function that revokes tokens
    async logout() {
        try {
            // Call logout endpoint to revoke token
            if (this.accessToken) {
                await this.fetchWithAuth('/api/auth/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }).catch(error => console.warn('Logout API error:', error));
            }
        } finally {
            // Clear any scheduled token refresh
            if (this.refreshTimeout) {
                clearTimeout(this.refreshTimeout);
                this.refreshTimeout = null;
            }
            
            // Clear client storage
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('tokenExpiry');
            localStorage.removeItem('currentUser');
            sessionStorage.removeItem('accessToken');
            sessionStorage.removeItem('refreshToken');
            sessionStorage.removeItem('tokenExpiry');
            sessionStorage.removeItem('currentUser');
            
            // Clear cookie (will be handled by server)
            document.cookie = 'auth_token=; path=/; max-age=0';
            
            // Clear state
            this.accessToken = null;
            this.refreshToken = null;
            this.tokenExpiry = 0;
            this.currentUser = null;
            
            // Redirect to login
            window.location.href = '/login';
        }
    }

    // Schedule token refresh before expiration
    scheduleTokenRefresh() {
        // Clear any existing timeout
        if (this.refreshTimeout) {
            clearTimeout(this.refreshTimeout);
            this.refreshTimeout = null;
        }
        
        // If no tokens or invalid expiry, don't schedule refresh
        if (!this.accessToken || !this.refreshToken || !this.tokenExpiry) {
            return;
        }
        
        // Calculate time until refresh (token expiry minus threshold)
        const timeUntilRefresh = this.tokenExpiry - Date.now() - this.tokenRefreshThreshold;
        
        // If token is already expired or will expire very soon, refresh now
        if (timeUntilRefresh <= 0) {
            this.refreshAccessToken();
            return;
        }
        
        // Schedule refresh
        this.refreshTimeout = setTimeout(() => {
            this.refreshAccessToken();
        }, timeUntilRefresh);
        
        console.log(`Token refresh scheduled in ${Math.round(timeUntilRefresh / 1000)} seconds`);
    }
    
    // Refresh access token using refresh token
    async refreshAccessToken() {
        // If already refreshing, return the existing promise
        if (this.refreshPromise) {
            return this.refreshPromise;
        }
        
        // Create a new refresh promise
        this.refreshPromise = (async () => {
            try {
                // Check if we have a refresh token
                if (!this.refreshToken) {
                    throw new Error('No refresh token available');
                }
                
                // Determine storage type
                const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
                
                // Call refresh endpoint
                const response = await fetch(`/api/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        refresh_token: this.refreshToken
                    })
                });
                
                if (!response.ok) {
                    throw new Error('Failed to refresh token');
                }
                
                const data = await response.json();
                
                // Update tokens
                this.accessToken = data.access_token;
                this.refreshToken = data.refresh_token;
                this.tokenExpiry = Date.now() + (data.expires_in * 1000);
                
                // Update storage
                storage.setItem('accessToken', data.access_token);
                storage.setItem('refreshToken', data.refresh_token);
                storage.setItem('tokenExpiry', this.tokenExpiry.toString());
                
                // Schedule next refresh
                this.scheduleTokenRefresh();
                
                console.log('Token refreshed successfully');
                return this.accessToken;
            } catch (error) {
                console.error('Token refresh failed:', error);
                
                // If refresh fails, clear auth state and redirect to login
                this.logout();
                throw error;
            } finally {
                this.refreshPromise = null;
            }
        })();
        
        return this.refreshPromise;
    }
    
    // Enhanced getCurrentToken that handles token expiration
    async getCurrentToken() {
        // If token is expired or about to expire, refresh it
        const isExpired = !this.tokenExpiry || Date.now() > (this.tokenExpiry - this.tokenRefreshThreshold);
        
        if (this.refreshToken && isExpired) {
            try {
                return await this.refreshAccessToken();
            } catch (error) {
                // If refresh fails, fallback to existing token or null
                return this.accessToken || null;
            }
        }
        
        return this.accessToken || null;
    }
    
    // Add this enhanced fetch method that handles auth and retries
    async fetchWithAuth(url, options = {}) {
        // Get the current token (may refresh if needed)
        const token = await this.getCurrentToken();
        
        // Prepare options with auth header
        const authOptions = {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            }
        };
        
        // Make the request
        let response = await fetch(url, authOptions);
        
        // Handle 401 with retry after token refresh
        if (response.status === 401 && this.refreshToken) {
            try {
                // Force token refresh
                const newToken = await this.refreshAccessToken();
                
                // Retry request with new token
                authOptions.headers['Authorization'] = `Bearer ${newToken}`;
                response = await fetch(url, authOptions);
            } catch (error) {
                console.error('Auth retry failed:', error);
                // If refresh fails, logout
                this.logout();
                throw error;
            }
        }
        
        return response;
    }
}

if (!window.authManager) {
    window.authManager = new AuthManager();
}

// Add auth-related functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Login form handling
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            try {
                await window.authManager.login(email, password, rememberMe);
                // Redirect to home page after successful login
                window.location.href = '/';
            } catch (error) {
                // Show error message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = error.message || 'Login failed. Please try again.';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
            }
        });
    }
    
    // Logout button functionality
    const logoutButtons = document.querySelectorAll('.logout-button');
    logoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            window.authManager.logout();
        });
    });

    // Register form handling
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const firstName = document.getElementById('first-name').value;
            const lastName = document.getElementById('last-name').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Validate passwords match
            if (password !== confirmPassword) {
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Passwords do not match';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
                return;
            }
            
            // Prepare user data
            const userData = {
                email: email,
                password: password,
                first_name: firstName,
                last_name: lastName
            };
            
            try {
                // Call register method
                const result = await window.authManager.register(userData);
                
                // Show success message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Registration successful! Redirecting to login...';
                    messageDiv.className = 'message success';
                    messageDiv.style.display = 'block';
                }
                
                // Redirect to login page after a short delay
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } catch (error) {
                // Show error message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = error.message || 'Registration failed. Please try again.';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
            }
        });
    }
});