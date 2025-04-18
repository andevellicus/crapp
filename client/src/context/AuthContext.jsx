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
  
  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = async () => {
      // Skip auth check if we're on a public page
      const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password'];
      
      if (publicPaths.includes(window.location.pathname)) {
        // If we're on a public page, just set loading to false and return
        setLoading(false);
        return;
      }
    
      try {
        // Verify authentication by making a request to the user endpoint
        // Cookies will be sent automatically
        const response = await fetch('/api/user', {
          credentials: 'include' // Important: include cookies in request
        });

        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
          setIsAuthenticated(true);
          const deviceIdFromCookie = getCookie('device_id');
          if (deviceIdFromCookie) {
            setDeviceId(deviceIdFromCookie);
          }
        } else {
          // If auth fails, clear state
          clearAuthData();
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
    // Function to periodically check auth status
    const checkAuthStatus = async () => {
      try {
        // Simple endpoint to check if current session is valid
        const response = await fetch('/api/user', {
          credentials: 'include'
        });
        
        if (!response.ok) {
          // If auth fails, try refresh
          const refreshed = await refreshToken();
          if (!refreshed) {
            clearAuthData();
            navigate('/login');
          }
        }
      } catch (error) {
        console.error('Auth status check failed:', error);
        clearAuthData(); 
        navigate('/login');
      }
    };
    
    // If user is authenticated and no monitor exists, set it up
    if (isAuthenticated && !tokenMonitorId) {
      // Check auth every minute
      const intervalId = setInterval(checkAuthStatus, 60000);
      setTokenMonitorId(intervalId);
    } 
    // If user is NOT authenticated but monitor exists, clear it
    else if (!isAuthenticated && tokenMonitorId) {
      clearInterval(tokenMonitorId);
      setTokenMonitorId(null);
    }
    
    // Clean up on unmount
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
      // Get device ID from cookie if available and not already provided
      const deviceId = getCookie('device_id');
      if (deviceId && !deviceInfo.id) {
        deviceInfo.id = deviceId;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include', // Important: include cookies in response
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
      
      // Update state with user data
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
      // Add proper Content-Type header even with empty body
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json' // Important!
        },
        body: JSON.stringify({}) // Empty object as JSON
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear the token monitor interval BEFORE clearing auth data
      if (tokenMonitorId) {
        clearInterval(tokenMonitorId);
        setTokenMonitorId(null);
      }
      clearAuthData();
      navigate('/login');
    }
  };

  // Check for existing device ID in cookies
  const getCookie = (name) => {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  };

  // Refresh token function
  const refreshToken = async () => {
    try {
      // No need to send the token in the request body since it's in cookies
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', 
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        throw new Error('Failed to refresh token backend');
      }

      // Server sets the new cookies, no need to manually store them
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  // Clear authentication data - now just clears state
  const clearAuthData = () => {
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      loading,
      error,
      deviceId,
      login,
      logout
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