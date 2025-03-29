// static/js/auth.js - Authentication management

class AuthManager {
    constructor() {
        // Only handle UI state based on token existence
        this.refreshAuthState();
    }
    
    refreshAuthState() {
        this.token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
        this.currentUser = this.getUserFromStorage();
        this.deviceId = localStorage.getItem('deviceId') || sessionStorage.getItem('deviceId');
        
        // Update UI based on auth state
        this.updateHeader();
    }
    
    getUserFromStorage() {
        const userJSON = localStorage.getItem('currentUser') || sessionStorage.getItem('currentUser');
        return userJSON ? JSON.parse(userJSON) : null;
    }
    
    // Login function
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
            storage.setItem('authToken', data.token);
            storage.setItem('currentUser', JSON.stringify(data.user));
            storage.setItem('deviceId', data.device_id);
            
            this.refreshAuthState();
            return data.user;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }
    
    // Register function
    async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(userData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Registration failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }
    
    // Logout function
    logout() {
        // Clear client storage
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        
        // Clear cookie (will be handled by server)
        document.cookie = 'auth_token=; path=/; max-age=0';
        
        // Clear state
        this.token = null;
        this.currentUser = null;
        
        // Redirect to login
        window.location.href = '/login';
    }

    // Returns current token from local storage or session storage
    getCurrentToken() {
        return this.token;
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
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
    
    // Check if user is authenticated
    isAuthenticated() {
        return !!this.getCurrentToken();
    }
    
    // Check if current page requires authentication and redirect if needed
    checkAuthStatus() {
        const path = window.location.pathname;
        const publicPages = ['/login', '/register', '/forgot-password'];
        
        // If on a public page and already authenticated, redirect to assessment
        if (publicPages.includes(path) && this.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        
        // If on a protected page and not authenticated, redirect to login
        if (!publicPages.includes(path) && path !== '/' && !this.isAuthenticated()) {
            window.location.href = '/login';
            return;
        }
    }
    
    // Update header with user info or login/register links
    updateHeader() {
        // This will update the header based on authentication status
        // Implement if you have a header component that shows user info
    }
    
    // Show message to user
    showMessage(message, type = 'success') {
        const messageDiv = document.getElementById('message');
        if (!messageDiv) return;
        
        messageDiv.textContent = message;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 5000);
        }
    }
}

// Create global instance
window.authManager = new AuthManager();

// Add logout functionality to any logout buttons
document.addEventListener('DOMContentLoaded', function() {
    const logoutButtons = document.querySelectorAll('.logout-button');
    logoutButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            window.authManager.logout();
        });
    });
});