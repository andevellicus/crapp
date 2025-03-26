// static/js/devices.js - Devices management functionality

document.addEventListener('DOMContentLoaded', function() {
    // Check if user is authenticated
    if (!window.authManager || !window.authManager.isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    // Initialize devices page
    initDevicesPage();
});

// Initialize devices page
function initDevicesPage() {
    // Load user devices
    loadUserDevices();
    
    // Setup modals
    setupModals();
}

// Load user devices from API
async function loadUserDevices() {
    const devicesList = document.getElementById('devices-list');
    const noDevices = document.getElementById('no-devices');
    
    try {
        const response = await fetch('/api/devices', {
            headers: {
                'Authorization': `Bearer ${window.authManager.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load devices');
        }
        
        const devices = await response.json();
        
        // Clear loading indicator
        devicesList.innerHTML = '';
        
        if (devices.length === 0) {
            // Show empty state
            noDevices.style.display = 'block';
            return;
        }
        
        // Get current device ID
        const currentDeviceId = localStorage.getItem('deviceId') || sessionStorage.getItem('deviceId');
        
        // Render each device
        devices.forEach(device => {
            const deviceElement = createDeviceElement(device, device.id === currentDeviceId);
            devicesList.appendChild(deviceElement);
        });
        
        // Add event listeners for device actions
        setupDeviceActions();
    } catch (error) {
        console.error('Error loading devices:', error);
        devicesList.innerHTML = `
            <div class="error-state">
                <p>Error loading your devices. Please try again later.</p>
                <button class="retry-button" onclick="loadUserDevices()">Retry</button>
            </div>
        `;
    }
}

// Create a device element from template
function createDeviceElement(device, isCurrent) {
    // Clone the template
    const template = document.getElementById('device-template');
    const deviceElement = template.content.cloneNode(true);
    const deviceCard = deviceElement.querySelector('.device-card');
    
    // Mark current device
    if (isCurrent) {
        deviceCard.classList.add('current');
    }
    
    // Set device icon based on type
    const deviceTypeIcon = deviceCard.querySelector('.device-type-icon');
    deviceTypeIcon.classList.add(device.device_type?.toLowerCase() || 'desktop');
    
    // Set device information
    deviceCard.querySelector('.device-name-text').textContent = device.device_name || 'Unnamed Device';
    deviceCard.querySelector('.device-os').textContent = device.os || 'Unknown OS';
    deviceCard.querySelector('.device-browser').textContent = getBrowserName(device.browser) || 'Unknown Browser';
    
    // Format last active date
    const lastActive = new Date(device.last_active);
    deviceCard.querySelector('.last-active-date').textContent = formatDate(lastActive);
    
    // Set device ID for action buttons
    deviceCard.querySelector('.rename-device-btn').dataset.deviceId = device.id;
    deviceCard.querySelector('.remove-device-btn').dataset.deviceId = device.id;
    
    // If current device, disable the remove button
    if (isCurrent) {
        const removeBtn = deviceCard.querySelector('.remove-device-btn');
        removeBtn.disabled = true;
        removeBtn.title = 'You cannot remove the current device';
    }
    
    return deviceCard;
}

// Setup device action buttons
function setupDeviceActions() {
    // Rename button event listeners
    document.querySelectorAll('.rename-device-btn').forEach(button => {
        button.addEventListener('click', function() {
            const deviceId = this.dataset.deviceId;
            const deviceName = this.closest('.device-card').querySelector('.device-name-text').textContent;
            
            // Populate rename modal
            document.getElementById('rename-device-id').value = deviceId;
            document.getElementById('new-device-name').value = deviceName;
            
            // Show rename modal
            document.getElementById('rename-modal').classList.add('show');
        });
    });
    
    // Remove button event listeners
    document.querySelectorAll('.remove-device-btn').forEach(button => {
        button.addEventListener('click', function() {
            const deviceId = this.dataset.deviceId;
            
            // Populate delete modal
            document.getElementById('delete-device-id').value = deviceId;
            
            // Show delete modal
            document.getElementById('delete-modal').classList.add('show');
        });
    });
}

// Setup modals
function setupModals() {
    // Close modal buttons
    document.querySelectorAll('.close-modal, .cancel-button').forEach(button => {
        button.addEventListener('click', function() {
            this.closest('.modal').classList.remove('show');
        });
    });
    
    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                this.classList.remove('show');
            }
        });
    });
    
    // Rename device form submission
    const renameForm = document.getElementById('rename-device-form');
    if (renameForm) {
        renameForm.addEventListener('submit', function(event) {
            event.preventDefault();
            
            const deviceId = document.getElementById('rename-device-id').value;
            const newName = document.getElementById('new-device-name').value;
            
            renameDevice(deviceId, newName);
        });
    }
    
    // Delete device button
    const deleteButton = document.querySelector('.delete-button');
    if (deleteButton) {
        deleteButton.addEventListener('click', function() {
            const deviceId = document.getElementById('delete-device-id').value;
            removeDevice(deviceId);
        });
    }
}

// Rename a device
async function renameDevice(deviceId, newName) {
    try {
        const response = await fetch(`/api/devices/${deviceId}/rename`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${window.authManager.token}`
            },
            body: JSON.stringify({ device_name: newName })
        });
        
        if (!response.ok) {
            throw new Error('Failed to rename device');
        }
        
        // Close modal
        document.getElementById('rename-modal').classList.remove('show');
        
        // Show success message
        showMessage('Device renamed successfully', 'success');
        
        // Reload devices
        loadUserDevices();
    } catch (error) {
        console.error('Error renaming device:', error);
        showMessage('Error renaming device. Please try again.', 'error');
    }
}

// Remove a device
async function removeDevice(deviceId) {
    try {
        const response = await fetch(`/api/devices/${deviceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${window.authManager.token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to remove device');
        }
        
        // Close modal
        document.getElementById('delete-modal').classList.remove('show');
        
        // Show success message
        showMessage('Device removed successfully', 'success');
        
        // Reload devices
        loadUserDevices();
    } catch (error) {
        console.error('Error removing device:', error);
        showMessage('Error removing device. Please try again.', 'error');
    }
}

// Helper to extract browser name from user agent
function getBrowserName(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.indexOf("Firefox") > -1) {
        return "Firefox";
    } else if (userAgent.indexOf("Opera") > -1 || userAgent.indexOf("OPR") > -1) {
        return "Opera";
    } else if (userAgent.indexOf("Trident") > -1) {
        return "Internet Explorer";
    } else if (userAgent.indexOf("Edge") > -1) {
        return "Edge";
    } else if (userAgent.indexOf("Chrome") > -1) {
        return "Chrome";
    } else if (userAgent.indexOf("Safari") > -1) {
        return "Safari";
    } else {
        return "Unknown";
    }
}

// Format date nicely
function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return 'Unknown';
    }
    
    // Calculate time difference
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