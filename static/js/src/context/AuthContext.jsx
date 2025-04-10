// static/js/src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [tokenMonitorId, setTokenMonitorId] = useState(null);

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Verify token validity by making a request to the user endpoint
        const response = await fetch('/api/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
          setDeviceId(localStorage.getItem('device_id'));
        } else {
          // If token is invalid, try to refresh it
          const refreshed = await refreshToken();
          if (!refreshed) {
            // Clear invalid tokens
            clearAuthData();
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        setError('Authentication check failed');
        clearAuthData();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  useEffect(() => {
    // Function to check token expiration
    const checkTokenExpiration = () => {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      
      // Check if token is expired using JWT structure
      try {
        // Split the token to get the payload
        const payload = JSON.parse(atob(token.split('.')[1]));
        
        // Check expiration (exp is in seconds, Date.now() is in milliseconds)
        const isExpired = payload.exp * 1000 < Date.now();
        
        if (isExpired) {          
          // Try to refresh the token
          refreshToken().catch(() => {
            // If refresh fails, log out and redirect
            clearAuthData();
            
            // Add a message to display after redirect
            sessionStorage.setItem('auth_message', 'Your session has expired. Please log in again.');
            
            // Redirect to login
            navigate('/login');
          });
        }
      } catch (error) {
        console.error('Error checking token expiration:', error);
      }
    };
    
    // Only set up monitoring if user is authenticated
    if (isAuthenticated && !tokenMonitorId) {
      // Check token every minute
      const intervalId = setInterval(checkTokenExpiration, 60000);
      setTokenMonitorId(intervalId);
      
      // Initial check
      checkTokenExpiration();
    }
    
    // Clean up on unmount or when auth state changes
    return () => {
      if (tokenMonitorId) {
        clearInterval(tokenMonitorId);
        setTokenMonitorId(null);
      }
    };
  }, [isAuthenticated, navigate]);

  // Login function
  const login = async (email, password, deviceInfo = {}) => {
    setError(null);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, device_info: deviceInfo })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      
      // Store auth data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('device_id', data.device_id);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      
      // Update state
      setUser(data.user);
      setIsAuthenticated(true);
      setDeviceId(data.device_id);

      return data;
    } catch (error) {
      setError(error.message || 'Login failed');
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthData();
      navigate('/login');
    }
  };

  // Refresh token function
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
      clearAuthData();
      return false;
    }
  };

  // Clear authentication data
  const clearAuthData = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    setUser(null);
    setIsAuthenticated(false);
    setDeviceId(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      deviceId,
      loading,
      error,
      login,
      logout,
      refreshToken,
      clearAuthData
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;