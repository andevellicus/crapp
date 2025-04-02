document.addEventListener('DOMContentLoaded', function() {
    const resetPasswordRules = {
        new_password: { 
            required: true, 
            password: true, 
            minLength: 8 
        },
        confirm_password: { 
            required: true, 
            match: { 
                value: 'new_password', 
                message: 'Passwords must match' 
            } 
        }
    };

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
        confirmPassword.addEventListener('blur', function() {
            CRAPP.validation.validateField(this, { 
                required: true, 
                match: { value: 'new_password', message: 'Passwords must match' } 
            }, { new_password: newPassword.value });
        });
        
        newPassword.addEventListener('input', function() {
            if (confirmPassword.value) {
                CRAPP.validation.validateField(confirmPassword, { 
                    match: { value: 'new_password', message: 'Passwords must match' } 
                }, { new_password: this.value });
            }
        });
    }
    
    // Setup form submission
    const form = document.getElementById('reset-password-form');
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            // Validate form
            if (!CRAPP.validation.validateForm(this, resetPasswordRules)) {
                return;
            }
                        
            try {
                // Use API service
                await CRAPP.api.post('/api/auth/reset-password', {
                    token: token,
                    new_password: document.getElementById('new-password').value
                });
                
                // Show success message
                CRAPP.utils.showMessage('Your password has been reset successfully.', 'success');

                // Redirect to login
                setTimeout(() => {
                    window.location.href = '/login';
                }, 3000);
                
            } catch (error) {
                // Show API errors
                if (error.response && error.response.errors) {
                    CRAPP.validation.showAPIErrors(form, error.response.errors);
                } else {
                    CRAPP.utils.showMessage(error.message || 'Failed to reset password', 'error');
                }
            }
        });
    }
});

// Function to validate token with the server
async function validateToken(token) {
    try {
        const data = await CRAPP.api.get(`/api/auth/validate-reset-token?token=${encodeURIComponent(token)}`);
        
        document.getElementById('loading').style.display = 'none';
        
        if (data.valid) {
            // Token is valid, show reset form
            document.getElementById('token').value = token;
            document.getElementById('reset-form-container').style.display = 'block';
        } else {
            // Token is invalid
            document.getElementById('invalid-token').style.display = 'block';
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('invalid-token').style.display = 'block';
    }
}