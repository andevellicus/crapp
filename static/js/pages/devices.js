window.CRAPP = window.CRAPP || {};
CRAPP.devicesPage = {
    init: function() {
        // Check if user is authenticated
        if (!CRAPP.auth.isAuthenticated()) {
            CRAPP.auth.redirectToLogin();
            return;
        }
        
        // Load devices and setup modals
        this.loadUserDevices();
        this.setupModals();
    },
    
    loadUserDevices: async function() {
        const devicesList = document.getElementById('devices-list');
        const noDevices = document.getElementById('no-devices');
        
        try {
            // Use API service instead of direct fetch
            const devices = await CRAPP.api.get('/api/devices');
            
            // Clear loading indicator
            devicesList.innerHTML = '';
            
            if (devices.length === 0) {
                // Show empty state
                noDevices.style.display = 'block';
                return;
            }
            
            // Get current device ID
            const currentDeviceId = CRAPP.auth.getDeviceId();
            
            // Render each device
            devices.forEach(device => {
                const deviceElement = this.createDeviceElement(device, device.id === currentDeviceId);
                devicesList.appendChild(deviceElement);
            });
            
            // Add event listeners for device actions
            this.setupDeviceActions();
        } catch (error) {
            // Error handling is done by the API service
            // We can add custom UI error state if needed
            devicesList.innerHTML = `
                <div class="error-state">
                    <p>Error loading your devices. Please try again later.</p>
                    <button class="retry-button" onclick="CRAPP.devicesPage.loadUserDevices()">Retry</button>
                </div>
            `;
        }
    },

    createDeviceElement: function(device, isCurrent){
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
        deviceCard.querySelector('.last-active-date').textContent = CRAPP.utils.formatDate(lastActive);
        
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
    },

    // Setup device action buttons
    setupDeviceActions: function() {
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
    },
    
    // Setup modals
    setupModals: function() {
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
    },

    // Rename a device
    renameDevice: async function(deviceId, newName) {
        try {
            // Use API service instead of direct fetch
            await CRAPP.api.post(`/api/devices/${deviceId}/rename`, { 
                device_name: newName 
            });
            
            // Close modal
            document.getElementById('rename-modal').classList.remove('show');
            
            // Show success message
            CRAPP.utils.showMessage('Device renamed successfully', 'success');
            
            // Reload devices
            this.loadUserDevices();
        } catch (error) {
            // Error handling done by API service
        }
    },

    removeDevice: async function(deviceId) {
        try {
            // Use API service instead of direct fetch
            await CRAPP.api.delete(`/api/devices/${deviceId}`);
            
            // Close modal
            document.getElementById('delete-modal').classList.remove('show');
            
            // Show success message
            CRAPP.utils.showMessage('Device removed successfully', 'success');
            
            // Reload devices
            this.loadUserDevices();
        } catch (error) {
            // Error handling done by API service
        }
    },

    // Helper to extract browser name from user agent
    getBrowserName: function(userAgent) {
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
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    CRAPP.devicesPage.init();
});