import { useNavigate } from 'react-router-dom';
export default function ResetPassword() {
    const [formData, setFormData] = React.useState({
      new_password: '',
      confirm_password: ''
    });
    const [token, setToken] = React.useState('');
    const [isValidating, setIsValidating] = React.useState(true);
    const [isValidToken, setIsValidToken] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [messageType, setMessageType] = React.useState('');
    const navigate = useNavigate();
    
    // Extract token from URL on component mount
    React.useEffect(() => {
      const queryParams = new URLSearchParams(window.location.search);
      const urlToken = queryParams.get('token');
      
      if (!urlToken) {
        setIsValidating(false);
        setIsValidToken(false);
        setMessage('Invalid password reset link. Please request a new one.');
        setMessageType('error');
        return;
      }
      
      // Validate token with backend
      validateToken(urlToken);
    }, []);
    
    const validateToken = async (tokenValue) => {
      try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${tokenValue}`);
        
        if (!response.ok) {
          throw new Error('Invalid or expired token');
        }
        
        const data = await response.json();
        
        if (data.valid) {
          setToken(tokenValue);
          setIsValidToken(true);
        } else {
          setMessage('Your password reset link has expired. Please request a new one.');
          setMessageType('error');
        }
      } catch (error) {
        setMessage('Your password reset link is invalid. Please request a new one.');
        setMessageType('error');
      } finally {
        setIsValidating(false);
      }
    };
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const validateForm = () => {
      // Clear previous messages
      setMessage('');
      
      // Validate password
      if (formData.new_password.length < 8) {
        setMessage('Password must be at least 8 characters long');
        setMessageType('error');
        return false;
      }
      
      // Check password complexity
      const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (!passwordRegex.test(formData.new_password)) {
        setMessage('Password must include uppercase, lowercase, and numbers');
        setMessageType('error');
        return false;
      }
      
      // Check password match
      if (formData.new_password !== formData.confirm_password) {
        setMessage('Passwords do not match');
        setMessageType('error');
        return false;
      }
      
      return true;
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!validateForm()) return;
      
      setIsSubmitting(true);
      
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            token: token,
            new_password: formData.new_password
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to reset password');
        }
        
        setMessage('Your password has been reset successfully! Redirecting to login...');
        setMessageType('success');
        
        // Clear form
        setFormData({
          new_password: '',
          confirm_password: ''
        });
        
        // Redirect to login after a delay
        setTimeout(() => {
          navigate('/login');
        }, 3000);
        
      } catch (error) {
        setMessage(error.message || 'Failed to reset password. Please try again.');
        setMessageType('error');
      } finally {
        setIsSubmitting(false);
      }
    };
    
    if (isValidating) {
      return (
        <div className="auth-container">
          <h3>Set New Password</h3>
          <div style={{ textAlign: 'center' }}>
            <p>Validating your reset link...</p>
          </div>
        </div>
      );
    }
    
    if (!isValidToken) {
      return (
        <div className="auth-container">
          <h3>Set New Password</h3>
          {message && (
            <div className={`message ${messageType}`} style={{ display: 'block' }}>
              {message}
            </div>
          )}
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a href="/forgot-password" className="submit-button" style={{ display: 'inline-block' }}>
              Request New Link
            </a>
          </div>
        </div>
      );
    }
    
    return (
      <div className="auth-container">
        <h3>Set New Password</h3>
        
        {message && (
          <div className={`message ${messageType}`} style={{ display: 'block' }}>
            {message}
          </div>
        )}
        
        <form className="auth-form" onSubmit={handleSubmit}>
          <input type="hidden" name="token" value={token} />
          
          <div className="form-group">
            <label htmlFor="new_password">New Password</label>
            <input
              type="password"
              id="new_password"
              name="new_password"
              value={formData.new_password}
              onChange={handleChange}
              required
              minLength="8"
              pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
            />
            <div className="password-requirements">
              Passwords must be at least 8 characters long and include uppercase letters, 
              lowercase letters, and numbers.
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirm_password">Confirm New Password</label>
            <input
              type="password"
              id="confirm_password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
            />
          </div>
          
          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Resetting Password...' : 'Reset Password'}
          </button>
        </form>
      </div>
    );
  }