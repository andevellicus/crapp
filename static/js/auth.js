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
}

// Create global instance
window.authManager = new AuthManager();

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