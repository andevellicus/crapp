// static/js/pages/register.js
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('register-form');
    
    if (!form) return;
    
    // If user is already authenticated, redirect to home
    if (CRAPP.auth && CRAPP.auth.isAuthenticated()) {
        window.location.href = '/';
        return;
    }
    
    // Define validation rules
    const registerRules = {
        email: { required: true, email: true },
        first_name: { required: true },
        last_name: { required: true },
        password: { required: true, password: true, minLength: 8 },
        confirm_password: { required: true, match: { value: 'password', message: 'Passwords must match' } },
        terms: { checked: true }
    };
    
    // Handle form submission
    form.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Validate form
        if (!CRAPP.validation.validateForm(this, registerRules)) {
            return;
        }
        
        // Get validated form data
        const formData = CRAPP.validation.getFormValues(this);
        
        /* DEPRECATED
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
            */
        
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
            await CRAPP.auth.register({
                email: formData.email,
                password: formData.password,
                first_name: formData.first_name,
                last_name: formData.last_name
            });
            
            // Show success message and redirect
            CRAPP.utils.showMessage('Account created successfully!', 'success');
            
            // Redirect after short delay
            setTimeout(() => {
                window.location.href = '/';
            }, 1000);
            
        } catch (error) {
            // Show API errors if available
            if (error.response && error.response.errors) {
                CRAPP.validation.showAPIErrors(form, error.response.errors);
            } else {
                // Show general error message
                CRAPP.utils.showMessage(error.message || 'Registration failed. Please try again.', 'error');
            }
            
            // Reset button
            submitButton.disabled = false;
            submitButton.textContent = originalButtonText;
        }
    });
});