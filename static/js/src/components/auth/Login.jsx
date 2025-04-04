// static/js/src/components/auth/Login.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState('');

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Redirect to the page they were trying to access or home
      const from = location.state?.from || '/';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear errors when user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setGeneralError('');
    
    // Validate form
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Get device info
      const deviceInfo = {
        user_agent: navigator.userAgent,
        screen_size: {
          width: window.screen.width,
          height: window.screen.height
        },
        device_name: navigator.platform || 'Unknown Device',
        device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
        remember_me: formData.rememberMe
      };
      
      // Call login function from auth context
      await login(formData.email, formData.password, deviceInfo);
      
      // If login succeeds, the useEffect will handle redirection
    } catch (error) {
      // Handle login error
      if (error.data?.details) {
        // Field-specific errors
        const fieldErrors = {};
        error.data.details.forEach(detail => {
          fieldErrors[detail.field] = detail.message;
        });
        setErrors(fieldErrors);
      } else {
        // General error
        setGeneralError(error.message || 'Login failed. Please check your credentials and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-container">
      <h3>Login</h3>
      
      {generalError && (
        <div className="message error" style={{ display: 'block' }}>
          {generalError}
        </div>
      )}
      
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            className={errors.email ? 'error-field' : ''}
            autoComplete="email"
          />
          {errors.email && <div className="validation-error">{errors.email}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className={errors.password ? 'error-field' : ''}
            autoComplete="current-password"
          />
          {errors.password && <div className="validation-error">{errors.password}</div>}
        </div>
        
        <div className="form-group checkbox-group">
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleChange}
          />
          <label htmlFor="rememberMe">Remember me</label>
        </div>
        
        <button 
          type="submit" 
          className="submit-button" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>
      </form>
      
      <div className="auth-links">
        <Link to="/register">Don't have an account? Register</Link>
        <Link to="/forgot-password">Forgot your password?</Link>
      </div>
    </div>
  );
};

export default Login;