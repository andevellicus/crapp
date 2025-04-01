// static/js/pages/login.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('login-form');
    
    if (!form) return;
    
    // If user is already authenticated, redirect to home
    if (CRAPP.auth && CRAPP.auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    // Check for redirect URL from sessionStorage
    let redirectUrl = '/';
    try {
        const savedRedirect = sessionStorage.getItem('auth_redirect');
        if (savedRedirect) {
            redirectUrl = savedRedirect;
            sessionStorage.removeItem('auth_redirect');
        }
    } catch (error) {
        console.error('Error reading redirect URL:', error);
    }
    
    // Handle form submission
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Get form data
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const rememberMe = document.getElementById('remember-me')?.checked || false;
        
        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Logging in...';
        
        // Clear any previous messages
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.display = 'none';
        }
        
        try {
            // Get device info from navigator and screen
            const deviceInfo = {
                user_agent: navigator.userAgent,
                screen_width: window.screen.width,
                screen_height: window.screen.height,
                device_name: navigator.platform || 'Unknown Device',
                device_type: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
                remember_me: rememberMe
            };
            
            // Use auth service to login
            await CRAPP.auth.login(email, password, deviceInfo);
            
            // Show success message briefly before redirecting
            if (messageDiv) {
                messageDiv.textContent = 'Login successful!';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
            }
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = redirectUrl;
            }, 500);
            
        } catch (error) {
            console.error('Login error:', error);
            
            // Show error message
            if (messageDiv) {
                messageDiv.textContent = error.message || 'Login failed. Please check your credentials and try again.';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
            }
            
            // Reset button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});