// static/js/core/auth.js

/**
 * Authentication module for CRAPP application
 * Handles login, logout, token management, and user info
 */
window.CRAPP = window.CRAPP || {};
CRAPP.auth = (function() {
  // Private variables
  const AUTH_TOKEN_KEY = 'auth_token';
  const REFRESH_TOKEN_KEY = 'refresh_token';
  const USER_INFO_KEY = 'user_info';
  const DEVICE_ID_KEY = 'device_id';
  
  // Determine if we should use localStorage or sessionStorage
  const storage = window.localStorage;
  
  // Current user data
  let currentUser = null;
  let currentToken = null;
  let refreshToken = null;
  let deviceId = null;
  
  // Initialize on load
  function init() {
    // Load saved tokens and user data
    loadTokens();
    loadUserInfo();
  }
  
  // Load tokens from storage
  function loadTokens() {
    try {
      currentToken = storage.getItem(AUTH_TOKEN_KEY);
      refreshToken = storage.getItem(REFRESH_TOKEN_KEY);
      deviceId = storage.getItem(DEVICE_ID_KEY);
    } catch (error) {
      console.error('Error loading auth tokens:', error);
    }
  }
  
  // Load user info from storage
  function loadUserInfo() {
    try {
      const userInfo = storage.getItem(USER_INFO_KEY);
      if (userInfo) {
        currentUser = JSON.parse(userInfo);
      }
    } catch (error) {
      console.error('Error loading user info:', error);
    }
  }
  
  // Save tokens to storage
  function saveTokens(accessToken, refreshTokenValue, expiresIn) {
    try {
      if (accessToken) {
        storage.setItem(AUTH_TOKEN_KEY, accessToken);
        currentToken = accessToken;
        
        // Set auto-expiry if expiresIn is provided
        if (expiresIn) {
          const expiryTime = Date.now() + (expiresIn * 1000);
          storage.setItem(AUTH_TOKEN_KEY + '_expiry', expiryTime);
        }
      }
      
      if (refreshTokenValue) {
        storage.setItem(REFRESH_TOKEN_KEY, refreshTokenValue);
        refreshToken = refreshTokenValue;
      }
    } catch (error) {
      console.error('Error saving auth tokens:', error);
    }
  }
  
  // Save user info to storage
  function saveUserInfo(user) {
    try {
      if (user) {
        storage.setItem(USER_INFO_KEY, JSON.stringify(user));
        currentUser = user;
      }
    } catch (error) {
      console.error('Error saving user info:', error);
    }
  }
  
  // Save device ID
  function saveDeviceId(id) {
    try {
      if (id) {
        storage.setItem(DEVICE_ID_KEY, id);
        deviceId = id;
      }
    } catch (error) {
      console.error('Error saving device ID:', error);
    }
  }
  
  // Clear all auth data
  function clearAuthData() {
    try {
      storage.removeItem(AUTH_TOKEN_KEY);
      storage.removeItem(REFRESH_TOKEN_KEY);
      storage.removeItem(USER_INFO_KEY);
      storage.removeItem(AUTH_TOKEN_KEY + '_expiry');
      
      // Don't clear device ID - it's tied to the browser/device
      
      currentToken = null;
      refreshToken = null;
      currentUser = null;
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }
  
  // Check if token is expired
  function isTokenExpired() {
    try {
      const expiryTime = storage.getItem(AUTH_TOKEN_KEY + '_expiry');
      if (!expiryTime) return false;
      
      return Date.now() > parseInt(expiryTime);
    } catch (error) {
      console.error('Error checking token expiry:', error);
      return true; // Assume expired on error
    }
  }
  
  // Public methods
  return {
    /**
     * Initialize the auth module
     */
    initialize: function() {
      init();
      return this.isAuthenticated();
    },
    
    /**
     * Check if user is authenticated
     * @returns {boolean} - True if authenticated
     */
    isAuthenticated: function() {
      loadTokens(); // Refresh from storage
      return !!currentToken && !isTokenExpired();
    },
    
    /**
     * Get the current JWT token
     * @returns {string|null} - Current token or null
     */
    getCurrentToken: function() {
      if (isTokenExpired() && refreshToken) {
        // Try to refresh the token if expired
        this.refreshToken();
      }
      return currentToken;
    },
    
    /**
     * Get the current user data
     * @returns {Object|null} - User data or null
     */
    getCurrentUser: function() {
      return currentUser;
    },
    
    /**
     * Get the device ID
     * @returns {string|null} - Device ID or null
     */
    getDeviceId: function() {
      return deviceId;
    },
    
    /**
     * Login user with credentials
     * @param {string} email - User email
     * @param {string} password - User password
     * @param {Object} deviceInfo - Optional device info
     * @returns {Promise} - Login result
     */
    login: async function(email, password, deviceInfo = {}) {
      try {
        // Use the API service for login
        const data = await CRAPP.api.post('/api/auth/login', {
          email: email,
          password: password,
          device_info: deviceInfo
        });
        
        // Save authentication data
        saveTokens(data.access_token, data.refresh_token, data.expires_in);
        saveUserInfo(data.user);
        saveDeviceId(data.device_id);
        
        return data;
      } catch (error) {
        console.error('Login failed:', error);
        throw error;
      }
    },
    
    /**
     * Register a new user
     * @param {Object} userData - User registration data
     * @returns {Promise} - Registration result
     */
    register: async function(userData) {
      try {
        // Use the API service for registration
        const data = await CRAPP.api.post('/api/auth/register', userData);
        
        // If register auto-logs in the user, save auth data
        if (data.access_token) {
          saveTokens(data.access_token, data.refresh_token, data.expires_in);
          saveUserInfo(data.user);
          saveDeviceId(data.device_id);
        }
        
        return data;
      } catch (error) {
        console.error('Registration failed:', error);
        throw error;
      }
    },
    
    /**
     * Logout the current user
     * @returns {Promise} - Logout result
     */
    logout: async function() {
      try {
        // Call logout API if authenticated
        if (this.isAuthenticated()) {
          await CRAPP.api.post('/api/auth/logout');
        }
        
        // Clear auth data regardless of API call result
        clearAuthData();
        
        return true;
      } catch (error) {
        console.error('Logout failed:', error);
        // Still clear local auth data even if API call fails
        clearAuthData();
        return false;
      }
    },
    
    /**
     * Refresh the access token using refresh token
     * @returns {Promise<boolean>} - True if token refreshed successfully
     */
    refreshToken: async function() {
      try {
        // If no refresh token, can't refresh
        if (!refreshToken) {
          return false;
        }
        
        // Use the device ID if available
        const deviceQueryParam = deviceId ? `?device_id=${deviceId}` : '';
        
        // Call refresh API
        const data = await fetch(`/api/auth/refresh${deviceQueryParam}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            refresh_token: refreshToken
          })
        }).then(res => res.json());
        
        // Save new tokens
        saveTokens(data.access_token, data.refresh_token, data.expires_in);
        
        return true;
      } catch (error) {
        console.error('Token refresh failed:', error);
        
        // If refresh fails, clear auth data and redirect to login
        clearAuthData();
        return false;
      }
    },
    
    /**
     * Redirect to login page
     * @param {string} [returnUrl] - URL to return to after login
     */
    redirectToLogin: function(returnUrl = window.location.pathname) {
      // Save current URL to redirect back after login
      if (returnUrl !== '/login') {
        try {
          sessionStorage.setItem('auth_redirect', returnUrl);
        } catch (error) {
          console.error('Error saving redirect URL:', error);
        }
      }
      
      // Redirect to login page
      window.location.href = '/login';
    },
    
    /**
     * Update the current user's information
     * @param {Object} userData - Updated user data
     */
    updateCurrentUser: function(userData) {
      if (userData && currentUser) {
        // Merge new data with existing user data
        currentUser = { ...currentUser, ...userData };
        saveUserInfo(currentUser);
      }
    }
  };
})();

// Initialize auth module when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  CRAPP.auth.initialize();
  
  // Setup logout button handler
  const logoutButtons = document.querySelectorAll('.logout-button');
  if (logoutButtons) {
    logoutButtons.forEach(button => {
      button.addEventListener('click', function(e) {
        e.preventDefault();
        CRAPP.auth.logout().then(() => {
          window.location.href = '/login';
        });
      });
    });
  }
});