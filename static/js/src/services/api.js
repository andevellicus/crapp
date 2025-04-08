// Base API configurations
const API_BASE = '';  // Empty for same-origin API

// Function to refresh the token - imported directly
const refreshToken = async () => {
  try {
    const refreshToken = localStorage.getItem('refresh_token');
    const deviceId = localStorage.getItem('device_id');
    
    if (!refreshToken) {
      return false;
    }

    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        refresh_token: refreshToken,
        device_id: deviceId
      })
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    
    // Update stored tokens
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // Clear authentication data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    return false;
  }
};

// Create a request handler with automatic token refreshing
const apiRequest = async (url, options = {}) => {
  // Get auth token
  const token = localStorage.getItem('auth_token');
  
  // Set up headers with auth token if available
  const headers = {
    ...options.headers,
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const deviceId = localStorage.getItem('device_id');
  if (deviceId) {
    headers['X-Device-ID'] = deviceId;
  }

  // Make the request
  try {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers
    });

    // Handle unauthorized error (token expired)
    if (response.status === 401) {
      // Try to refresh the token
      const refreshed = await refreshToken();
      
      // If refresh successful, retry the original request
      if (refreshed) {
        // Get the new token
        const newToken = localStorage.getItem('auth_token');
        
        // Update headers with new token
        headers.Authorization = `Bearer ${newToken}`;
        
        // Retry the request
        return fetch(`${API_BASE}${url}`, {
          ...options,
          headers
        }).then(handleResponse);
      } else {
        // If refresh failed, throw an error
        throw new Error('Authentication failed');
      }
    }

    return handleResponse(response);
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Handle API responses
const handleResponse = async (response) => {
  // Extract the response data
  let data;
  try {
    // Check if response has JSON content
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
  } catch (error) {
    console.error('Error parsing response:', error);
    data = { error: 'Failed to parse response' };
  }

  // Check if response is successful
  if (!response.ok) {
    // Create error object with response details
    const error = new Error(data.error || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

// API methods
export const api = {
  // GET request
  get: (url) => apiRequest(url),
  
  // POST request
  post: (url, data) => apiRequest(url, {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  
  // PUT request
  put: (url, data) => apiRequest(url, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  
  // DELETE request
  delete: (url) => apiRequest(url, {
    method: 'DELETE'
  })
};

export default api;