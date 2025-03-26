// static/js/profile.js - Profile page functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    if (!window.authManager || !window.authManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    // Initialize profile form
    initProfileForm();
});

// Initialize profile form
function initProfileForm() {
    const form = document.getElementById('profile-form');
    if (!form) return;
    
    // Load user data
    loadUserData();
    
    // Setup form submission
    form.addEventListener('submit', function(event) {
        event.preventDefault();
        updateProfile();
    });
    
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
        
        // Clear validation when typing in new password
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
}

// Load user data from local storage or API
async function loadUserData() {
    try {
        // First check if we already have user data in storage
        let userData = window.authManager.currentUser;
        
        // If not, fetch from API
        if (!userData) {
            const response = await fetch('/api/user', {
                headers: {
                    'Authorization': `Bearer ${window.authManager.token}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load user data');
            }
            
            userData = await response.json();
            window.authManager.currentUser = userData;
        }
        
        // Populate form fields
        populateUserForm(userData);
    } catch (error) {
        console.error('Error loading user data:', error);
        showMessage('Error loading your profile data. Please try again later.', 'error');
    }
}

// Populate user form with data
function populateUserForm(userData) {
    const emailField = document.getElementById('email');
    const firstNameField = document.getElementById('first-name');
    const lastNameField = document.getElementById('last-name');
    
    if (emailField) emailField.value = userData.email || '';
    if (firstNameField) firstNameField.value = userData.first_name || '';
    if (lastNameField) lastNameField.value = userData.last_name || '';
}

// Update user profile
async function updateProfile() {
    const form = document.getElementById('profile-form');
    const currentPassword = document.getElementById('current-password');
    const newPassword = document.getElementById('new-password');
    const firstName = document.getElementById('first-name');
    const lastName = document.getElementById('last-name');
    
    // Prepare the update data
    const updateData = {
        first_name: firstName.value.trim(),
        last_name: lastName.value.trim()
    };
    
    // Include password only if the user is changing it
    if (newPassword.value) {
        if (!currentPassword.value) {
            showMessage('Please enter your current password to change your password', 'error');
            return;
        }
        
        updateData.current_password = currentPassword.value;
        updateData.new_password = newPassword.value;
    }
    
    try {
        const response = await fetch('/api/user', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager.token}`
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update profile');
        }
        
        // Update was successful
        const updatedUser = await response.json();
        
        // Update local storage
        window.authManager.currentUser = updatedUser;
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        // Reset password fields
        if (currentPassword) currentPassword.value = '';
        if (newPassword) newPassword.value = '';
        const confirmPassword = document.getElementById('confirm-password');
        if (confirmPassword) confirmPassword.value = '';
        
        // Show success message
        showMessage('Your profile has been updated successfully', 'success');
    } catch (error) {
        console.error('Error updating profile:', error);
        showMessage(error.message || 'Error updating your profile. Please try again.', 'error');
    }
}

// Show message to user
function showMessage(message, type = 'success') {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Auto-hide success messages after 5 seconds
    if (type === 'success') {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 5000);
    }
}