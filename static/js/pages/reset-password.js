document.addEventListener('DOMContentLoaded', function() {
    // Get token from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        // No token provided, show invalid token message
        document.getElementById('loading').style.display = 'none';
        document.getElementById('invalid-token').style.display = 'block';
        return;
    }
    
    // Validate token
    validateToken(token);
    
    // Setup password confirmation validation
    const newPassword = document.getElementById('new-password');
    const confirmPassword = document.getElementById('confirm-password');
    
    if (newPassword && confirmPassword) {
        confirmPassword.addEventListener('input', () => {
            if (newPassword.value !== confirmPassword.value) {
                confirmPassword.setCustomValidity('Passwords do not match');
            } else {
                confirmPassword.setCustomValidity('');
            }
        });
        
        newPassword.addEventListener('input', () => {
            if (confirmPassword.value) {
                if (newPassword.value !== confirmPassword.value) {
                    confirmPassword.setCustomValidity('Passwords do not match');
                } else {
                    confirmPassword.setCustomValidity('');
                }
            }
        });
    }
    
    // Setup form submission
    const form = document.getElementById('reset-password-form');
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            // Check if passwords match
            if (newPassword !== confirmPassword) {
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Passwords do not match';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
                return;
            }
            
            try {
                const response = await CRAPP.api.post('/api/auth/reset-password', {
                    token: token,
                    new_password: newPassword 
                })
                
                if (response.ok) {
                    // Show success message
                    const messageDiv = document.getElementById('message');
                    if (messageDiv) {
                        messageDiv.textContent = data.message || 'Your password has been reset successfully.';
                        messageDiv.className = 'message success';
                        messageDiv.style.display = 'block';
                    }
                    
                    // Redirect to login after 3 seconds
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 3000);
                } else {
                    throw new Error(data.error || 'Failed to reset password');
                }
                
            } catch (error) {
                console.error('Error resetting password:', error);
                
                // Show error message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = error.message || 'Failed to reset your password. Please try again.';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
            }
        });
    }
});

// Function to validate token with the server
async function validateToken(token) {
    try {
        const response = await fetch(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        
        document.getElementById('loading').style.display = 'none';
        
        if (data.valid) {
            // Token is valid, show reset form
            document.getElementById('token').value = token;
            document.getElementById('reset-form-container').style.display = 'block';
        } else {
            // Token is invalid, show error message
            document.getElementById('invalid-token').style.display = 'block';
        }
    } catch (error) {
        console.error('Error validating token:', error);
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('invalid-token').style.display = 'block';
    }
}