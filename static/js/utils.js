// static/js/utils.js - Common utility functions

/**
 * Shows a message to the user with optional auto-hide
 * @param {string} message - Message text to display
 * @param {string} type - Message type ('success' or 'error')
 * @param {number} [timeout] - Optional timeout in ms to auto-hide (default 5000 for success)
 */
function showMessage(message, type = 'success', timeout = null) {
    const messageDiv = document.getElementById('message');
    if (!messageDiv) return;
    
    messageDiv.textContent = message;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
    
    // Scroll to message
    messageDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    // Auto-hide success messages after timeout
    if (type === 'success' && (timeout === null)) {
        timeout = 5000;
    }
    
    if (timeout) {
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, timeout);
    }
}

/**
 * Format date for display
 * @param {Date|string} date - Date to format
 * @param {Object} [options] - Formatting options
 * @returns {string} Formatted date
 */
function formatDate(date, options = {}) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }
    
    if (isNaN(date.getTime())) {
        return 'Invalid date';
    }
    
    // Default formatting options
    const defaultOptions = {
        relative: false,
        format: 'short' // 'short', 'medium', 'long'
    };
    
    options = {...defaultOptions, ...options};
    
    // If relative is true, use relative formatting
    if (options.relative) {
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDays = Math.floor(diffHour / 24);
        
        if (diffDays > 30) {
            return date.toLocaleDateString();
        } else if (diffDays > 0) {
            return diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
        } else if (diffHour > 0) {
            return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
        } else if (diffMin > 0) {
            return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
        } else {
            return 'Just now';
        }
    }
    
    // Otherwise, use locale-based formatting
    let formatOptions = {};
    
    switch(options.format) {
        case 'short':
            formatOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            };
            break;
        case 'medium':
            formatOptions = {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            break;
        case 'long':
            formatOptions = {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            };
            break;
    }
    
    return date.toLocaleString('en-US', formatOptions);
}

/**
 * Makes an API request with proper authentication and error handling
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options (method, body, etc.)
 * @returns {Promise} Promise resolving to parsed JSON response
 */
async function apiRequest(url, options = {}) {
    // Ensure we have headers
    options.headers = options.headers || {};
    
    // Add authentication token if available
    if (window.authManager && window.authManager.getCurrentToken()) {
        options.headers.Authorization = `Bearer ${window.authManager.getCurrentToken()}`;
    }
    
    // Add content type for JSON requests
    if (options.body && typeof options.body !== 'string') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }
    
    try {
        const response = await fetch(url, options);
        
        if (!response.ok) {
            // Try to get error message from response
            try {
                const errorData = await response.json();
                throw new Error(errorData.error || `Request failed with status ${response.status}`);
            } catch (e) {
                throw new Error(`Request failed with status ${response.status}`);
            }
        }
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        return await response.text();
    } catch (error) {
        console.error('API request error:', error);
        throw error;
    }
}

/**
 * Validates form data
 * @param {HTMLFormElement} form - Form element to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateForm(form) {
    const requiredInputs = form.querySelectorAll('[required]');
    let isValid = true;
    
    requiredInputs.forEach(input => {
        // For radio buttons, check if any in the group is selected
        if (input.type === 'radio') {
            const name = input.name;
            const checked = form.querySelector(`input[name="${name}"]:checked`);
            
            if (!checked) {
                isValid = false;
                showValidationMessage(input.closest('.form-group'), 
                    'Please select an option before continuing.');
            }
            return;
        }
        
        // For other inputs, check if they have a value
        if (!input.value.trim()) {
            isValid = false;
            showValidationMessage(input.closest('.form-group'), 
                'Please complete all required fields.');
        }
    });
    
    return isValid;
}

/**
 * Shows validation error message
 * @param {HTMLElement} containerEl - Container element to show message in
 * @param {string} message - Error message to display
 */
function showValidationMessage(containerEl, message) {
    let msgEl = containerEl.querySelector('.validation-message');
    
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.className = 'validation-message';
        containerEl.appendChild(msgEl);
    }
    
    msgEl.textContent = message;
    msgEl.style.display = 'block';
    
    // Highlight the container
    containerEl.classList.add('highlight-required');
}

/**
 * Clears validation errors
 * @param {HTMLElement} containerEl - Container element to clear errors from
 */
function clearValidationMessage(containerEl) {
    const msgEl = containerEl.querySelector('.validation-message');
    if (msgEl) {
        msgEl.style.display = 'none';
    }
    
    containerEl.classList.remove('highlight-required');
}

// Export functions to make them available globally
window.CRAPP = window.CRAPP || {};
window.CRAPP.utils = {
    showMessage,
    formatDate,
    apiRequest,
    validateForm,
    showValidationMessage,
    clearValidationMessage
};