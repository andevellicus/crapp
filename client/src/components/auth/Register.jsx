import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '../../context/AuthContext';
import TermsModal from '../common/TermsModal';

export default function Register() {
    const [formData, setFormData] = useState({
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      confirm_password: ''
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const navigate = useNavigate();
    
    const { login } = useAuth();
    
    const handleChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    const handleTermsChange = (e) => {
      setTermsAccepted(e.target.checked);
    };
    
    const openTermsModal = (e) => {
      e.preventDefault();
      setShowTermsModal(true);
    };
    
    const closeTermsModal = () => {
      setShowTermsModal(false);
    };
    
    const acceptTerms = () => {
      setTermsAccepted(true);
      setShowTermsModal(false);
    };
    
    const validateForm = () => {
      // Clear previous errors
      setError('');
      
      // Check required fields
      if (!formData.email || !formData.first_name || !formData.last_name || !formData.password) {
        setError('All fields are required');
        return false;
      }
      
      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Please enter a valid email address');
        return false;
      }
      
      // Validate password
      if (formData.password.length < 8) {
        setError('Password must be at least 8 characters long');
        return false;
      }
      
      // Check password complexity
      const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (!passwordRegex.test(formData.password)) {
        setError('Password must include uppercase, lowercase, and numbers');
        return false;
      }
      
      // Check password match
      if (formData.password !== formData.confirm_password) {
        setError('Passwords do not match');
        return false;
      }
      
      // Check terms
      if (!termsAccepted) {
        setError('You must accept the terms and conditions');
        return false;
      }
      
      return true;
    };
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      // Validate form
      if (!validateForm()) return;
      
      // Show loading state
      setIsLoading(true);
      setError('');
      
      try {
        // Register API call
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            first_name: formData.first_name,
            last_name: formData.last_name
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Registration failed');
        }
               
        // Show success message
        window.showMessage && window.showMessage('Registration successful! Please log in.', 'success');
        
        // Redirect to login
        navigate('/login');
        
      } catch (error) {
        setError(error.message || 'Registration failed. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    return (
      <>
        <Helmet>
          <title>Register - CRAPP</title>
          <meta name="description" content="Create an account for CRAPP - Cognitive Reporting Application" />
        </Helmet>
        
        <div className="auth-container">
          <h3>Create an Account</h3>
          
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
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
              />
            </div>
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleChange}
                  required
                  autoComplete="given-name"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="last_name">Last Name</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleChange}
                  required
                  autoComplete="family-name"
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                minLength="8"
                pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
              />
              <div className="password-requirements">
                Passwords must be at least 8 characters long and include uppercase letters, 
                lowercase letters, and numbers.
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirm_password">Confirm Password</label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleChange}
                required
                autoComplete="new-password"
              />
            </div>
            
            <div className="form-group checkbox-group">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={termsAccepted}
                onChange={handleTermsChange}
                required
              />
              <label htmlFor="terms">
                I agree to the <a href="#" onClick={openTermsModal}>Terms and Conditions</a>
              </label>
            </div>
            
            <button type="submit" className="submit-button" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          
          <div className="auth-links">
            <Link to="/login">Already have an account? Login</Link>
          </div>
        </div>
        
        {/* Terms Modal */}
        <TermsModal 
          isOpen={showTermsModal} 
          onClose={acceptTerms} 
        />
      </>
    );
  }