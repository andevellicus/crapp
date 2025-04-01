document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('forgot-password-form');
    if (form) {
        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const email = document.getElementById('email').value;
            
            try {
                const data = await CRAPP.api.post('/api/auth/forgot-password', email)
                
                // Show success message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = data.message || 'Password reset instructions have been sent to your email.';
                    messageDiv.className = 'message success';
                    messageDiv.style.display = 'block';
                }
                
                // Clear the form
                form.reset();
                
            } catch (error) {
                console.error('Error requesting password reset:', error);
                
                // Show error message
                const messageDiv = document.getElementById('message');
                if (messageDiv) {
                    messageDiv.textContent = 'Failed to process your request. Please try again.';
                    messageDiv.className = 'message error';
                    messageDiv.style.display = 'block';
                }
            }
        });
    }
});