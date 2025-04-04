export default function Login() {
    const [email, setEmail] = React.useState('');
    const [password, setPassword] = React.useState('');
    const [rememberMe, setRememberMe] = React.useState(false);
    const [error, setError] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    
    const { login } = useAuth();
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Basic validation
      if (!email || !password) {
        setError('Please enter both email and password');
        return;
      }
      
      // Show loading state
      setIsLoading(true);
      setError('');
      
      try {
        // Get device info
        const deviceInfo = {
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          device_name: navigator.platform || 'Unknown Device',
          device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
          remember_me: rememberMe
        };
        
        // Use auth context to login
        await login(email, password, deviceInfo);
        
        // Redirect to home page
        window.location.href = '/';
      } catch (error) {
        setError(error.message || 'Login failed. Please check your credentials and try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    return (
      <div className="auth-container">
        <h3>Login</h3>
        
        {error && (
          <div className="message error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          
          <div className="form-group checkbox-group">
            <input
              type="checkbox"
              id="remember-me"
              name="remember-me"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <label htmlFor="remember-me">Remember me</label>
          </div>
          
          <button type="submit" className="submit-button" disabled={isLoading}>
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <div className="auth-links">
          <a href="/register">Don't have an account? Register</a>
          <a href="/forgot-password">Forgot your password?</a>
        </div>
      </div>
    );
  }