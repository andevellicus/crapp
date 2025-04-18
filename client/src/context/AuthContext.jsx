import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCookie } from '../utils/utils';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const inactivityTimerRef = useRef(null);
  const INACTIVITY_TIMEOUT = 20 * 60 * 1000; // 20 minutes in milliseconds

  // Clear authentication data 
  const clearAuthData = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    // No need to clear deviceId from state if it's read from cookie on auth check
    clearTimeout(inactivityTimerRef.current); // Clear inactivity timer on logout
  }, []); // No dependencies needed if it only uses setters and refs
  
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
        // Use the apiRequest wrapper from api.js which handles 401s and refresh
        // Note: api.js will hard redirect on failed refresh during this check
        const response = await fetch('/api/user', {
          credentials: 'include'
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

    // Run only once on mount; subsequent auth checks rely on api.js or inactivity timer
    checkAuth();
  }, []);

  // Login function
  const login = async (email, password, deviceInfo = {}) => {
    setError(null);
    setLoading(true); // Indicate loading during login
    
    try {     
      // Get device ID from cookie if available and not already provided
      const deviceId = getCookie('device_id');
      if (deviceId && !deviceInfo.id) {
        deviceInfo.id = deviceId;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
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
      resetInactivityTimer(); // Start inactivity timer after login
      return data;
    } catch (error) {
      setError(error.message || 'Login failed');
      clearAuthData(); // Ensure clean state on failed login
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout function (now also clears inactivity timer)
  const logout = useCallback(async () => {
    // Clear timer immediately
    if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
    }
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}) 
      });
    } catch (error) {
      console.error('Logout API call error:', error);
    } finally {
      clearAuthData();
      navigate('/login');
    }
  }, [navigate, clearAuthData]);

  // Inactivity Timer Logic
  const resetInactivityTimer = useCallback(() => {
    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    // Set a new timer only if authenticated
    if (isAuthenticated) {
        inactivityTimerRef.current = setTimeout(() => {
            console.log('Inactivity timeout reached. Logging out.');
            logout(); // Call logout when timer expires
        }, INACTIVITY_TIMEOUT);
    }
  }, [logout, isAuthenticated, INACTIVITY_TIMEOUT]);

  useEffect(() => {
    // Only run the inactivity logic if the user is authenticated
    if (isAuthenticated) {
      // List of events that indicate user activity
      const activityEvents = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
      
      // Add event listeners to reset the timer on activity
      activityEvents.forEach(event => {
        window.addEventListener(event, resetInactivityTimer);
      });

      // Initial timer start
      resetInactivityTimer();

      // Cleanup function: remove event listeners and clear timer on unmount or when auth changes
      return () => {
        activityEvents.forEach(event => {
          window.removeEventListener(event, resetInactivityTimer);
        });
        if (inactivityTimerRef.current) {
          clearTimeout(inactivityTimerRef.current);
        }
      };
    } else {
        // If not authenticated, ensure timer is cleared
         if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }
    }
  }, [isAuthenticated, resetInactivityTimer]);  

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