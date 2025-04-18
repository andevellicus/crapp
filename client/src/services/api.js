import { getCookie } from '../utils/utils';

// Base API configurations
const API_BASE = '';

// Function to refresh the token
const refreshToken = async () => {
  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include', // Include cookies
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    // Cookies are automatically set by the server
    return true;
  } catch (error) {
    console.error('Token refresh failed:', error);
    // No localStorage to clear, just return false
    return false;
  }
};

// Create a request handler that includes credentials (cookies)
const apiRequest = async (url, options = {}) => {
  // Always include credentials
  const requestOptions = {
    ...options,
    credentials: 'include', // Critical for cookies to be sent
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  };

  // Add CSRF token for non-GET requests
  if (options.method && options.method !== 'GET') {
    const csrfToken = getCookie('csrf_token');
  
    if (csrfToken) {
      requestOptions.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  try {
    let response = await fetch(`${API_BASE}${url}`, requestOptions);

    // Handle 401 by attempting to refresh the token
    if (response.status === 401) {
      // Try to refresh the token
      const refreshed = await refreshToken();
      
      // If refresh successful, retry the original request
      if (refreshed) {
        // No need to update headers, cookies are sent automatically
        return fetch(`${API_BASE}${url}`, requestOptions)
          .then(handleResponse);
      } else {
        // If refresh failed, redirect to login
        window.location.href = '/login?expired=true';
        return null;
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
    // Handle unauthorized errors with redirect
    if (response.status === 401) {
      // Redirect to login page
      window.location.href = '/login';
      return null;
    }

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