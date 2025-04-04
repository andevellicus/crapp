// Authentication context for user state
const AuthContext = React.createContext();

function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [deviceId, setDeviceId] = React.useState(null);
  
  React.useEffect(() => {
    // Check if user is already authenticated (e.g., from localStorage)
    const storedUser = JSON.parse(localStorage.getItem('user_info'));
    const storedToken = localStorage.getItem('auth_token');
    const storedDeviceId = localStorage.getItem('device_id');
    
    if (storedUser && storedToken) {
      setUser(storedUser);
      setIsAuthenticated(true);
      setDeviceId(storedDeviceId);
    }
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
  
  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      deviceId,
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