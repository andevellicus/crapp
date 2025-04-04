// Authentication context for user state
const AuthContext = React.createContext();

export default function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState(null);
  const [authChecked, setAuthChecked] = React.useState(false);
  
  React.useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);
        
        // Check if the response is unauthorized
        if (response.status === 401) {
          // Try to refresh token once
          const refreshed = await refreshToken();
          if (!refreshed) {
            // If refresh failed, log out
            await logout();
            return response;
          }
          
          // If token was refreshed, retry the request with new token
          const [url, config] = args;
          const newConfig = {
            ...config,
            headers: {
              ...config?.headers,
              'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
          };
          return originalFetch(url, newConfig);
        }
        return response;
      } catch (error) {
        throw error;
      }
    };
    
    // Check token expiration on load
    checkTokenExpiration();
    
    // Set interval to check token expiration
    const interval = setInterval(checkTokenExpiration, 60000); // Every minute
    
    return () => {
      window.fetch = originalFetch;
      clearInterval(interval);
    };
  }, []);
  
  // Login function
  const login = async (email, password, deviceInfo) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password, device_info: deviceInfo })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      
      const data = await response.json();
      
      // Store authentication data
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      localStorage.setItem('device_id', data.device_id);
      
      // Update state
      setUser(data.user);
      setIsAuthenticated(true);
      setDeviceId(data.device_id);

      // Trigger storage event for header to detect
      window.dispatchEvent(new Event('storage'));
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };
  
  // Logout function
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear auth data
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    
    // Update state
    setUser(null);
    setIsAuthenticated(false);

    // Trigger storage event for header to detect
    window.dispatchEvent(new Event('storage'));
    
    // Redirect to login
    window.location.href = '/login';
  };
  
  // Refresh token function
  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
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
      
      // Clear auth data on refresh failure
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
      
      setUser(null);
      setIsAuthenticated(false);
      setDeviceId(null);
      
      return false;
    }
  };

  const checkTokenExpiration = () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    
    // Parse token to check expiration (without library)
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      
      const payload = JSON.parse(jsonPayload);
      
      // Check if token is expired or will expire in next 5 min
      if (payload.exp * 1000 < Date.now() + 300000) {
        refreshToken();
      }
    } catch (e) {
      console.error('Error checking token expiration', e);
    }
  };
  
  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      deviceId,
      authChecked,
      login,
      logout,
      refreshToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook for using auth context
function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}