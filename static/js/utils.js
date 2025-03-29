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

// Export functions to make them available globally
window.CRAPP = window.CRAPP || {};
window.CRAPP.utils = {
    showMessage,
    formatDate,
};