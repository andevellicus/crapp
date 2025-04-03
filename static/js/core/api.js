/**
 * Core API client for CRAPP application
 * Handles all API requests with consistent error handling and authentication
 */
window.CRAPP = window.CRAPP || {};
CRAPP.api = (function() {
  // Private variables
  const API_BASE = ''; // Empty for same-origin API
  
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
      if (!window.isRefreshingToken && CRAPP.auth) {
        window.isRefreshingToken = true;
        
        try {
          if (await CRAPP.auth.refreshToken()) {
            window.isRefreshingToken = false;
            // Retry original request with new token
            const retryOptions = await withAuth({
              method: response.request?.method || 'GET',
              headers: response.request?.headers || {},
              body: response.request?.body
            });
            return fetch(response.url, retryOptions).then(handleResponse);
          }
        } catch (error) {
          // Ignore refresh errors and continue with normal error flow
        }
        
        window.isRefreshingToken = false;
      }
      
      // If we get here, refresh failed or wasn't attempted - handle logout
      if (!window.isHandlingAuthRedirect) {
        window.isHandlingAuthRedirect = true;
        CRAPP.auth.redirectToLogin();
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