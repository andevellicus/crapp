export default function ForgotPassword() {
    const [email, setEmail] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [message, setMessage] = React.useState('');
    const [messageType, setMessageType] = React.useState('');
    
    const handleSubmit = async (e) => {
      e.preventDefault();
      
      if (!email) {
        setMessage('Please enter your email address');
        setMessageType('error');
        return;
      }
      
      setIsSubmitting(true);
      setMessage('');
      
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email })
        });
        
        // Always show success message even if email doesn't exist (security)
        setMessage('If your email is registered, you will receive a password reset link shortly.');
        setMessageType('success');
        setEmail('');
        
      } catch (error) {
        console.error('Error requesting password reset:', error);
        setMessage('Failed to process your request. Please try again later.');
        setMessageType('error');
      } finally {
        setIsSubmitting(false);
      }
    };
    
    return (
      <div className="auth-container">
        <h3>Reset Your Password</h3>
        
        {message && (
          <div className={`message ${messageType}`} style={{ display: 'block' }}>
            {message}
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
          
          <p className="form-info">
            Enter your email address and we'll send you a link to reset your password.
          </p>
          
          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
        
        <div className="auth-links">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    );
  }