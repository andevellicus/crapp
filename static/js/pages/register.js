// static/js/pages/register.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('register-form');
    
    if (!form) return;
    
    // If user is already authenticated, redirect to home
    if (CRAPP.auth && CRAPP.auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    // Setup password confirmation validation
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirm-password');
    
    if (password && confirmPassword) {
        // Validate passwords match
        confirmPassword.addEventListener('input', function() {
            if (password.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        });
        
        // Clear validation when password changes
        password.addEventListener('input', function() {
            if (confirmPassword.value) {
                if (password.value !== confirmPassword.value) {
                    confirmPassword.setCustomValidity('Passwords do not match');
                } else {
                    confirmPassword.setCustomValidity('');
                }
            }
        });
    }
    
    // Handle form submission
    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Validate passwords match
        if (password.value !== confirmPassword.value) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'Passwords do not match';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
            }
            return;
        }
        
        // Get form data
        const userData = {
            email: document.getElementById('email').value,
            password: password.value,
            first_name: document.getElementById('first-name').value,
            last_name: document.getElementById('last-name').value
        };
        
        // Check terms agreement
        const termsChecked = document.getElementById('terms').checked;
        if (!termsChecked) {
            const messageDiv = document.getElementById('message');
            if (messageDiv) {
                messageDiv.textContent = 'You must agree to the Terms and Conditions';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
            }
            return;
        }
        
        // Show loading state
        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonText = submitButton.textContent;
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';
        
        // Clear any previous messages
        const messageDiv = document.getElementById('message');
        if (messageDiv) {
            messageDiv.style.display = 'none';
        }
        
        try {
            // Use auth service to register
            await CRAPP.auth.register(userData);
            
            // Show success message briefly before redirecting
            if (messageDiv) {
                messageDiv.textContent = 'Account created successfully!';
                messageDiv.className = 'message success';
                messageDiv.style.display = 'block';
            }
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (error) {
            console.error('Registration error:', error);
            
            // Show error message
            if (messageDiv) {
                messageDiv.textContent = error.message || 'Registration failed. Please try again.';
                messageDiv.className = 'message error';
                messageDiv.style.display = 'block';
            }
            
            // Reset button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});