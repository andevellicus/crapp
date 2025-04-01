// static/js/profile.js - Refactored with centralized API service

window.CRAPP = window.CRAPP || {};
CRAPP.profilePage = {
    init: function() {
        // Check if user is authenticated
        if (!CRAPP.auth.isAuthenticated()) {
            CRAPP.auth.redirectToLogin();
            return;
        }
        
        const form = document.getElementById('profile-form');
        if (!form) return;
        
        // Load user data
        this.loadUserData();
        
        // Setup form submission
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            this.updateProfile();
        });
        
        // Setup password confirmation validation
        this.setupPasswordValidation();
    },
    
    setupPasswordValidation: function() {
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
    },
    
    loadUserData: async function() {
        try {
            // Get user data from auth service or API
            let userData = CRAPP.auth.getCurrentUser();
            
            // If not available locally, fetch from API
            if (!userData) {
                userData = await CRAPP.api.get('/api/user');
                // The API service handles errors automatically
            }
            
            // Populate form with user data
            this.populateUserForm(userData);
        } catch (error) {
            // Error handling is done by the API service
        }
    },
    
    populateUserForm: function(userData) {
        const emailField = document.getElementById('email');
        const firstNameField = document.getElementById('first-name');
        const lastNameField = document.getElementById('last-name');
        
        if (emailField) emailField.value = userData.email || '';
        if (firstNameField) firstNameField.value = userData.first_name || '';
        if (lastNameField) lastNameField.value = userData.last_name || '';
    },
    
    updateProfile: async function() {
        const currentPassword = document.getElementById('current-password');
        const newPassword = document.getElementById('new-password');
        const firstName = document.getElementById('first-name');
        const lastName = document.getElementById('last-name');
        
        // Prepare update data
        const updateData = {
            first_name: firstName.value.trim(),
            last_name: lastName.value.trim()
        };
        
        // Add password fields if user is changing password
        if (newPassword.value) {
            if (!currentPassword.value) {
                CRAPP.utils.showMessage('Please enter your current password to change your password', 'error');
                return;
            }
            
            updateData.current_password = currentPassword.value;
            updateData.new_password = newPassword.value;
        }
        
        try {
            // Use the API service to update profile
            const updatedUser = await CRAPP.api.put('/api/user', updateData, {}, this.handleProfileUpdateError);
            
            // Handle successful update
            this.handleProfileUpdateSuccess(updatedUser);
        } catch (error) {
            // Most error handling is done by the API service
            // We just need to handle specific form-related errors
        }
    },
    
    handleProfileUpdateSuccess: function(updatedUser) {
        // Clear password fields
        const currentPassword = document.getElementById('current-password');
        const newPassword = document.getElementById('new-password');
        const confirmPassword = document.getElementById('confirm-password');
        
        if (currentPassword) currentPassword.value = '';
        if (newPassword) newPassword.value = '';
        if (confirmPassword) confirmPassword.value = '';
        
        // Show success message
        CRAPP.utils.showMessage('Your profile has been updated successfully', 'success');
    },
    
    handleProfileUpdateError: function(error) {
        // This is a custom error handler for profile-specific errors
        // Return true if we handled it, false to let the API service handle it
        
        // Example: Handle password-specific errors
        if (error.response && error.response.code === 'INVALID_PASSWORD') {
            document.getElementById('current-password').classList.add('error');
            CRAPP.utils.showMessage('Current password is incorrect', 'error');
            return true;
        }
        
        // Let the API service handle other errors
        return false;
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    CRAPP.profilePage.init();
});