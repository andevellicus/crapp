window.CRAPP = window.CRAPP || {};
CRAPP.profilePage = {
    profileRules: {
        first_name: { required: true },
        last_name: { required: true },
        current_password: { 
            required: function(formValues) {
                return formValues.new_password && formValues.new_password.length > 0;
            }
        },
        new_password: { 
            minLength: { value: 8, message: 'New password must be at least 8 characters' },
            required: false
        },
        confirm_password: { 
            match: { value: 'new_password', message: 'Passwords must match' },
            required: function(formValues) {
                return formValues.new_password && formValues.new_password.length > 0;
            }
        }
    },

    init: function() {
        // Check if user is authenticated
        if (!CRAPP.auth.isAuthenticated()) {
            CRAPP.auth.redirectToLogin();
            return;
        }
        
        // Clear any validation errors that might be present
        const form = document.getElementById('profile-form');
        if (form) {
            CRAPP.validation.clearErrors(form);
            
            // Load user data
            this.loadUserData();

            const deleteAccountButton = document.getElementById('delete-account-button');
            if (deleteAccountButton) {
                deleteAccountButton.addEventListener('click', this.deleteAccount.bind(this));
            }
            this.setupDeleteAccountModal();
            
            // Setup form submission (only validate on submit)
            form.addEventListener('submit', (event) => {
                event.preventDefault();
                this.updateProfile();
            });
                        
            this.setupPasswordValidation();
        }
    },
    
    setupPasswordValidation: function() {
        const newPassword = document.getElementById('new-password');
        const confirmPassword = document.getElementById('confirm-password');
        const currentPassword = document.getElementById('current-password');
        
        if (newPassword && confirmPassword) {
            // Validate confirm password when it loses focus
            confirmPassword.addEventListener('blur', function() {
                CRAPP.validation.validateField(this, { 
                    match: { value: 'new_password', message: 'Passwords must match' } 
                }, { new_password: newPassword.value });
            });
            
            // Revalidate confirm password when new password changes
            newPassword.addEventListener('input', function() {
                if (confirmPassword.value) {
                    CRAPP.validation.validateField(confirmPassword, { 
                        match: { value: 'new_password', message: 'Passwords must match' } 
                    }, { new_password: this.value });
                }
                
                // Validate current password requirement
                if (this.value && currentPassword) {
                    CRAPP.validation.validateField(currentPassword, { 
                        required: true,
                        message: 'Current password is required when changing password'
                    });
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
        const form = document.getElementById('profile-form');
        
        // Validate form
        if (!CRAPP.validation.validateForm(form, CRAPP.profilePage.profileRules)) {
            return; // Stop if validation fails
        }
        
        // Get validated form data
        const formData = CRAPP.validation.getFormValues(form);
        
        try {
            // Use the API service to update profile
            const updatedUser = await CRAPP.api.put('/api/user', formData);
            
            // Handle successful update
            this.handleProfileUpdateSuccess(updatedUser);
        } catch (error) {
            // Show API errors if available
            if (error.response && error.response.errors) {
                CRAPP.validation.showAPIErrors(form, error.response.errors);
            } else {
                // Show general error message
                CRAPP.utils.showMessage(error.message || 'Failed to update profile', 'error');
            }
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
    },

    deleteAccount: function() {
        const passwordInput = document.getElementById('delete-account-password');
        const password = passwordInput.value;
        
        if (!password) {
            CRAPP.utils.showMessage('Please enter your password to confirm account deletion', 'error');
            return;
        }
        
        // Show the modal
        const modal = document.getElementById('delete-account-modal');
        modal.classList.add('show');
        
        // Setup confirmation text field
        const confirmInput = document.getElementById('delete-confirmation');
        const confirmButton = document.getElementById('confirm-delete-button');
        
        // Reset input
        confirmInput.value = '';
        confirmButton.disabled = true;
        
        // Add input validation
        confirmInput.addEventListener('input', function() {
            confirmButton.disabled = this.value !== 'DELETE';
        });
        
        // Handle the final confirmation button
        confirmButton.onclick = async () => {
            try {
                // Use API service to delete account
                await CRAPP.api.post('/api/user/delete', {
                    password: password
                });
                
                // Hide modal
                modal.classList.remove('show');
                
                // Show success message
                CRAPP.utils.showMessage('Your account has been deleted successfully', 'success');
                
                // Log out and redirect to home page after a delay
                setTimeout(() => {
                    CRAPP.auth.logout();
                }, 2000);
                
            } catch (error) {
                // Hide modal
                modal.classList.remove('show');
                
                // Handle password validation errors
                if (error.response && error.response.status === 401) {
                    CRAPP.utils.showMessage('Incorrect password', 'error');
                    passwordInput.value = '';
                } else {
                    // Handle other errors
                    CRAPP.utils.showMessage(error.message || 'Failed to delete account', 'error');
                }
            }
        };
    },

    setupDeleteAccountModal: function() {
        // Close modal buttons
        document.querySelectorAll('#delete-account-modal .close-modal, #delete-account-modal .cancel-button').forEach(button => {
            button.addEventListener('click', function() {
                document.getElementById('delete-account-modal').classList.remove('show');
            });
        });
        
        // Click outside modal to close
        const modal = document.getElementById('delete-account-modal');
        if (modal) {
            modal.addEventListener('click', function(event) {
                if (event.target === this) {
                    this.classList.remove('show');
                }
            });
        }
    }
};

function setupNotificationSettings() {
    const enableNotificationsCheckbox = document.getElementById('enable-notifications');
    const enableEmailCheckbox = document.getElementById('enable-email-notifications');
    const notificationSettings = document.getElementById('notification-settings');
    const addReminderTimeButton = document.getElementById('add-reminder-time');
    
    if (!enableNotificationsCheckbox && !enableEmailCheckbox) return;
    
    // Load notification preferences
    CRAPP.notifications.getPreferences().then(preferences => {
        // Update UI based on preferences
        if (enableNotificationsCheckbox) {
            enableNotificationsCheckbox.checked = preferences.push_enabled;
            
            // Handle push notification toggle
            enableNotificationsCheckbox.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                
                if (enabled) {
                    // Use new service to request permission
                    const permissionGranted = await CRAPP.notifications.requestPermission();
                    if (!permissionGranted) {
                        e.target.checked = false;
                        return;
                    }
                }
                
                // Update preferences via notification service
                const preferences = await CRAPP.notifications.getPreferences();
                preferences.push_enabled = enabled;
                await CRAPP.notifications.savePreferences(preferences);
                
                // Update UI visibility
                updateNotificationUI(preferences);
            });
        }
        
        if (enableEmailCheckbox) {
            enableEmailCheckbox.checked = preferences.email_enabled;
            
            // Handle email notification toggle
            enableEmailCheckbox.addEventListener('change', async (e) => {
                preferences.email_enabled = e.target.checked;
                await updateNotificationUI(preferences);
            });
        }
        
        // Initialize UI
        updateNotificationUI(preferences);
        
        // Add reminder time button
        if (addReminderTimeButton) {
            addReminderTimeButton.addEventListener('click', async () => {
                if (!preferences.reminder_times) {
                    preferences.reminder_times = [];
                }
                
                // Add default time (9 PM)
                preferences.reminder_times.push('21:00');
                await updateNotificationUI(preferences);
            });
        }
    });
}

// Update notification UI and save preferences
async function updateNotificationUI(preferences) {
    const notificationSettings = document.getElementById('notification-settings');
    
    // Show/hide settings based on enabled status
    if (notificationSettings) {
        const anyEnabled = preferences.push_enabled || preferences.email_enabled;
        notificationSettings.style.display = anyEnabled ? 'block' : 'none';
    }
    
    // Render reminder times
    renderReminderTimes(preferences.reminder_times || ['20:00']);
    
    // Save preferences
    await CRAPP.notifications.savePreferences(preferences);
}

// Render reminder times UI
function renderReminderTimes(times) {
    const container = document.getElementById('reminder-times');
    if (!container) return;
    
    // Clear container
    container.innerHTML = '';
    
    // Add each time input
    times.forEach((time, index) => {
        const timeContainer = document.createElement('div');
        timeContainer.className = 'reminder-time';
        timeContainer.style.display = 'flex';
        timeContainer.style.marginBottom = '10px';
        timeContainer.style.alignItems = 'center';
        timeContainer.style.gap = '10px';
        
        const timeInput = document.createElement('input');
        timeInput.type = 'time';
        timeInput.value = time;
        timeInput.addEventListener('change', async (e) => {
            const prefs = await CRAPP.notifications.getPreferences();
            prefs.reminder_times[index] = e.target.value;
            await CRAPP.notifications.savePreferences(prefs);
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'remove-time-btn';
        deleteButton.textContent = 'Remove';
        deleteButton.style.padding = '4px 8px';
        deleteButton.style.borderRadius = '4px';
        deleteButton.style.cursor = 'pointer';
        deleteButton.style.border = '1px solid #e53e3e';
        deleteButton.style.color = '#e53e3e';
        deleteButton.style.background = 'white';
        
        // Prevent removing last item
        if (times.length <= 1) {
            deleteButton.disabled = true;
            deleteButton.style.opacity = '0.5';
            deleteButton.style.cursor = 'not-allowed';
            deleteButton.title = 'At least one reminder time is required';
        }
        
        deleteButton.addEventListener('click', async () => {
            if (times.length <= 1) return;
            
            const prefs = await CRAPP.notifications.getPreferences();
            prefs.reminder_times.splice(index, 1);
            await updateNotificationUI(prefs);
        });
        
        timeContainer.appendChild(timeInput);
        timeContainer.appendChild(deleteButton);
        container.appendChild(timeContainer);
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    CRAPP.profilePage.init();
    if (document.getElementById('profile-form')) {
        setupNotificationSettings();
    }
});