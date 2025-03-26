// static/js/auth.js - Authentication management

class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
        this.deviceId = localStorage.getItem('deviceId');
        
        // Initialize event listeners based on current page
        this.initPage();
        
        // Check authentication status and redirect if needed
        this.checkAuthStatus();
    }
    
    // Initialize the current page
    initPage() {
        const path = window.location.pathname;
        
        if (path === '/login') {
            this.initLoginPage();
        } else if (path === '/register') {
            this.initRegisterPage();
        } else {
            // For other pages, initialize header if user is logged in
            this.updateHeader();
        }
    }
    
    // Initialize login page
    initLoginPage() {
        const loginForm = document.getElementById('login-form');
        if (!loginForm) return;
        
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            try {
                await this.login(email, password, rememberMe);
                // Redirect to home page with assessment
                window.location.href = '/';
            } catch (error) {
                this.showMessage(error.message || 'Login failed. Please check your credentials.', 'error');
            }
        });
    }
    
    // Initialize registration page
    initRegisterPage() {
        const registerForm = document.getElementById('register-form');
        if (!registerForm) return;
        
        // Add password confirmation validation
        const password = document.getElementById('password');
        const confirmPassword = document.getElementById('confirm-password');
        
        confirmPassword.addEventListener('input', () => {
            if (password.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        });
        
        registerForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            // Validate passwords match
            if (password.value !== confirmPassword.value) {
                this.showMessage('Passwords do not match', 'error');
                return;
            }
            
            const formData = {
                email: document.getElementById('email').value,
                first_name: document.getElementById('first-name').value,
                last_name: document.getElementById('last-name').value,
                password: password.value
            };
            
            try {
                await this.register(formData);
                // Show success message and redirect after delay
                this.showMessage('Registration successful! Redirecting to login...', 'success');
                setTimeout(() => {
                    window.location.href = '/login';
                }, 2000);
            } catch (error) {
                this.showMessage(error.message || 'Registration failed. Please try again.', 'error');
            }
        });
    }
    
    // Login function
    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
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
            this.token = data.token;
            this.currentUser = data.user;
            this.deviceId = data.device_id;
            
            // Store auth data
            localStorage.setItem('authToken', this.token);
            localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
            localStorage.setItem('deviceId', this.deviceId);
            
            // Also set a cookie for server-side authentication
            document.cookie = `auth_token=${this.token}; path=/; max-age=${rememberMe ? 86400*30 : 86400}`;
            
            // If not "remember me", set session storage instead of local storage
            if (!rememberMe) {
                sessionStorage.setItem('authToken', this.token);
                sessionStorage.setItem('currentUser', JSON.stringify(this.currentUser));
                sessionStorage.setItem('deviceId', this.deviceId);
                
                // Clear local storage
                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                localStorage.removeItem('deviceId');
            }
            
            return this.currentUser;
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
    async logout() {
        // Clear auth data
        localStorage.removeItem('authToken');
        localStorage.removeItem('currentUser');
        
        sessionStorage.removeItem('authToken');
        sessionStorage.removeItem('currentUser');
        
        // Clear auth cookie
        document.cookie = 'auth_token=; path=/; max-age=0';
        
        // Keep deviceId for possible reconnection
        
        this.token = null;
        this.currentUser = null;
        
        // Redirect to login page
        window.location.href = '/login';
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
        // Check both local and session storage
        const token = this.token || 
                      localStorage.getItem('authToken') || 
                      sessionStorage.getItem('authToken');
                      
        return !!token;
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