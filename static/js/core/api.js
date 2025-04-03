/**
 * Core API client for CRAPP application
 * Handles all API requests with consistent error handling and authentication
 */
window.CRAPP = window.CRAPP || {};
CRAPP.api = (function() {
  // Private variables
  const API_BASE = ''; // Empty for same-origin API

  let isRefreshingToken = false;
  let lastAuthRedirect = 0;
  const AUTH_REDIRECT_COOLDOWN = 1000; // 1 second cooldown between redirects
  
  // Default request options
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'same-origin'
  };
  
  /**
   * Add authentication token to request options
   * @param {Object} options - Request options
   * @returns {Object} - Options with auth headers
   */
  async function withAuth(options = {}) {
    if (options.bypassAuthRefresh) {
      delete options.bypassAuthRefresh;
      return options;
    }

    // Check if auth module is available
    if (!CRAPP.auth) {
      console.warn('Auth module not available');
      return options;
    }
    
    const token = await CRAPP.auth.getCurrentToken();
    
    if (!token) return options;
    
    const authOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    };
    
    // Add device ID if available
    const deviceId = CRAPP.auth.getDeviceId();
    if (deviceId) {
      authOptions.headers['X-Device-ID'] = deviceId;
    }
    
    return authOptions;
  }
  
  /**
   * Process API response
   * @param {Response} response - Fetch response
   * @returns {Promise} - Promise with processed data
   */
  async function handleResponse(response) {
    // Handle 401 separately for auth refresh logic
    if (response.status === 401) {
      // Skip refresh attempts for auth endpoints to prevent loops
      if (response.url.includes('/api/auth/')) {
        const error = await response.json().catch(() => ({ error: 'Authentication failed' }));
        throw { 
          message: error.error || 'Authentication failed',
          status: response.status,
          response: error 
        };
      }
      
      // For non-auth endpoints, try token refresh once
      if (isRefreshingToken && CRAPP.auth) {       
        try {
          isRefreshingToken = true;
          const refreshSucess = await CRAPP.auth.refreshToken();

          if (refreshSucess) {
            // Retry original request with new token
            const retryOptions = await withAuth({
              method: response.request?.method || 'GET',
              headers: response.request?.headers || {},
            });

            isRefreshingToken = false;
            return fetch(response.url, retryOptions).then(handleResponse);
          }

          // Clear local storage and session if refresh failed
          CRAPP.auth.clearAuthData && CRAPP.auth.clearAuthData();

        } catch (error) {
          // Ignore refresh errors and continue with normal error flow
          console.warn('Token refresh failed:', error);
        } finally {
          // Always reset the flag:
          isRefreshingToken = false;
        }
      }

      // Add debounce for redirects to prevent multiple redirects
      const now = Date.now();
      if (now - lastAuthRedirect > AUTH_REDIRECT_COOLDOWN) {
        lastAuthRedirect = now;
        // Use timeout to allow current error to be processed first
        setTimeout(() => {
          CRAPP.auth.redirectToLogin();
        }, 50);
      }
      
      throw new Error('Authentication failed');
    }
    
    // Handle other error responses
    if (!response.ok) {
      let error;
      
      try {
        error = await response.json();
      } catch (e) {
        error = { error: `Request failed with status ${response.status}` };
      }
      
      throw {
        message: error.message || error.error || `Request failed with status ${response.status}`,
        status: response.status,
        response: error
      };
    }
    
    // For 204 No Content, return empty object
    if (response.status === 204) {
      return {};
    }
    
    // Handle successful responses
    try {
      return await response.json();
    } catch (error) {
      // If response cannot be parsed as JSON, return empty object
      return {};
    }
  }
  
  /**
   * Common error handler
   * @param {Error} error - Error object
   * @param {function} callback - Optional callback for custom error handling
   */
  function handleError(error, callback) {
    console.error('API error:', error);
    
    // If custom callback is provided, let it handle the error first
    if (typeof callback === 'function' && callback(error) === true) {
      return Promise.reject(error);
    }
    
    // Default error handling - show message if utils is available
    if (CRAPP.utils && CRAPP.utils.showMessage) {
      CRAPP.utils.showMessage(error.message || 'An error occurred', 'error');
    }
    
    return Promise.reject(error);
  }
  
  return {
    /**
     * Make GET request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Additional fetch options
     * @param {function} errorCallback - Custom error handler
     * @returns {Promise} - API response
     */
    async get(endpoint, options = {}, errorCallback) {
      const url = API_BASE + endpoint;
      const authOptions = await withAuth({
        ...defaultOptions,
        ...options,
        method: 'GET'
      });
      
      return fetch(url, authOptions)
        .then(handleResponse)
        .catch(error => handleError(error, errorCallback));
    },
    
    /**
     * Make POST request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Data to send
     * @param {Object} options - Additional fetch options
     * @param {function} errorCallback - Custom error handler
     * @returns {Promise} - API response
     */
    async post(endpoint, data = {}, options = {}, errorCallback) {
      const url = API_BASE + endpoint;
      const authOptions = await withAuth({
        ...defaultOptions,
        ...options,
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      return fetch(url, authOptions)
        .then(handleResponse)
        .catch(error => handleError(error, errorCallback));
    },
    
    /**
     * Make PUT request
     * @param {string} endpoint - API endpoint
     * @param {Object} data - Data to send
     * @param {Object} options - Additional fetch options
     * @param {function} errorCallback - Custom error handler
     * @returns {Promise} - API response
     */
    async put(endpoint, data = {}, options = {}, errorCallback) {
      const url = API_BASE + endpoint;
      const authOptions = await withAuth({
        ...defaultOptions,
        ...options,
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
      return fetch(url, authOptions)
        .then(handleResponse)
        .catch(error => handleError(error, errorCallback));
    },
    
    /**
     * Make DELETE request
     * @param {string} endpoint - API endpoint
     * @param {Object} options - Additional fetch options
     * @param {function} errorCallback - Custom error handler
     * @returns {Promise} - API response
     */
    async delete(endpoint, options = {}, errorCallback) {
      const url = API_BASE + endpoint;
      const authOptions = await withAuth({
        ...defaultOptions,
        ...options,
        method: 'DELETE'
      });
      
      return fetch(url, authOptions)
        .then(handleResponse)
        .catch(error => handleError(error, errorCallback));
    }
  };
})();