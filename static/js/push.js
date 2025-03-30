// static/js/push.js

// Push notification handling
window.CRAPP = window.CRAPP || {};

CRAPP.pushNotifications = {
    // State
    vapidPublicKey: null,
    pushSubscription: null,
    preferences: null,
    
    // Initialize
    init: async function() {
        try {
            // More lenient check for notification support
            if (!window.Notification) {
                console.warn('Notifications API not supported');
                this.showNotSupportedMessage("Notifications are not supported in your browser.");
                return false;
            }
            
            // Check for service worker support with more detail
            if (!navigator.serviceWorker) {
                console.warn('Service Workers not supported');
                this.showNotSupportedMessage("Service Workers are not supported in your browser.");
                return false;
            }
                       
            // Check for push manager with more specific error
            if (!('PushManager' in window)) {
                console.warn('Push Manager not supported');
                this.showNotSupportedMessage("Push notifications are not supported in your browser.");
                return false;
            }
            
            // Load key and preferences
            await this.getVAPIDPublicKey();
            await this.loadPreferences();
            
            // Initialize UI
            this.initUI();
            
            // Check notification permission
            this.checkPermission();
            
            return true;
        } catch (error) {
            console.error('Error initializing push notifications:', error);
            this.showNotSupportedMessage("Error initializing notifications: " + error.message);
            return false;
        }
    },
    
    // Get VAPID public key from server
    getVAPIDPublicKey: async function() {
        try {
            const response = await fetch('/api/push/vapid-public-key', {
                headers: {
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to get VAPID public key');
            }
            
            const data = await response.json();
            this.vapidPublicKey = data.publicKey;
            
            return data.publicKey;
        } catch (error) {
            console.error('Error getting VAPID public key:', error);
            throw error;
        }
    },
    
    // Load user preferences
    loadPreferences: async function() {
        try {
            const response = await fetch('/api/push/preferences', {
                headers: {
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to load preferences');
            }
            
            this.preferences = await response.json();
        } catch (error) {
            console.error('Error loading preferences:', error);
            // Set default preferences
            this.preferences = {
                enabled: false,
                reminder_times: ['20:00'] // Default 8 PM
            };
        }
    },
    
    // Save user preferences
    savePreferences: async function() {
        try {           
            const response = await fetch('/api/push/preferences', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.preferences)
            });
            
            if (!response.ok) {
                console.error('Failed to save preferences:', response.status);
                throw new Error('Failed to save preferences');
            }
            return true;
        } catch (error) {
            console.error('Error saving preferences:', error);
            return false;
        }
    },
    
    // Check notification permission
    checkPermission: function() {
        const permission = Notification.permission;
        
        if (permission === 'granted') {
            // Already have permission
            return true;
        } else if (permission === 'denied') {
            // Permission was previously denied
            this.showPermissionDeniedMessage();
            return false;
        }
        
        // Permission not determined yet (default)
        return null;
    },
    
    // Request notification permission
    requestPermission: async function() {
        try {
            // This shows the browser permission dialog
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                // Permission granted - now subscribe to push
                const subscribed = await this.subscribeToPush();
                if (!subscribed) {
                    console.error('Failed to subscribe to push notifications');
                    return false;
                }
                return true;
            } else {
                console.warn('Notification permission denied');
                return false;
            }
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    },
    
    // Subscribe to push notifications
    subscribeToPush: async function() {
        try {            
            // Get registration without waiting for .ready which might hang
            let registration;
          
            // First check if we have an active service worker without using .ready
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
                registration = registrations[0];
            } else {
                try {
                    // Try to register the service worker directly
                    registration = await navigator.serviceWorker.register('/service-worker.js');
                } catch (err) {
                    console.error('Failed to register service worker:', err);
                    return false;
                }
            }
            
            if (!registration) {
                console.error('No service worker registration available');
                return false;
            }
            
            // Make sure we have the VAPID key
            if (!this.vapidPublicKey) {
                console.error('VAPID public key is missing');
                return false;
            }
            
            // Convert VAPID key to correct format
            const convertedVapidKey = this.urlBase64ToUint8Array(this.vapidPublicKey);
            
            // Subscribe to push manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            
            // Save subscription to server
            const saved = await this.saveSubscription(subscription);
            if (!saved) {
                console.error('Failed to save subscription on server');
                return false;
            }
            
            this.pushSubscription = subscription;
            return true;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            return false;
        }
    },
    
    // Save subscription to server
    saveSubscription: async function(subscription) {
        try {
            const response = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${window.authManager.getCurrentToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(subscription)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save subscription');
            }
            
            return true;
        } catch (error) {
            console.error('Error saving subscription:', error);
            return false;
        }
    },
    
    // Initialize UI
    initUI: function() {
        const enableNotificationsCheckbox = document.getElementById('enable-notifications');
        const notificationSettings = document.getElementById('notification-settings');
        const addReminderTimeButton = document.getElementById('add-reminder-time');
        
        if (!enableNotificationsCheckbox) return; // Not on profile page
        
        // Set initial state from preferences
        enableNotificationsCheckbox.checked = this.preferences && this.preferences.enabled;

        // Make sure to show/hide the settings based on checkbox state
        if (notificationSettings) {
            notificationSettings.style.display = this.preferences && this.preferences.enabled ? 'block' : 'none';
        }
        
        // Render reminder times
        this.renderReminderTimes();
        
        // Add checkbox event listener (with safeguard against duplicates)
        if (!enableNotificationsCheckbox.hasAttribute('data-initialized')) {
            enableNotificationsCheckbox.setAttribute('data-initialized', 'true');
            
        // Update the checkbox handler in initUI
        enableNotificationsCheckbox.addEventListener('change', async (e) => {
            const enabled = e.target.checked;
            
            // Update preferences structure regardless of permission status
            if (!this.preferences) this.preferences = {};
            if (!this.preferences.reminder_times || !Array.isArray(this.preferences.reminder_times)) {
                this.preferences.reminder_times = ['20:00']; // Default 8 PM
            }
            
            if (enabled) {
                // Request permission when user enables notifications
                const permissionGranted = await this.requestPermission();
                
                // If permission was denied or subscription failed
                if (!permissionGranted) {
                    console.warn('Permission denied or subscription failed');
                    e.target.checked = false;
                    this.preferences.enabled = false;
                    if (notificationSettings) {
                        notificationSettings.style.display = 'none';
                    }
                    return;
                }
                
                // Permission granted and subscription succeeded
                this.preferences.enabled = true;
            } else {
                // User unchecked the box
                this.preferences.enabled = false;
            }
            
            // Always update UI visibility
            if (notificationSettings) {
                notificationSettings.style.display = this.preferences.enabled ? 'block' : 'none';
            }
            
            // Always render time entries if settings are visible
            if (this.preferences.enabled) {
                this.renderReminderTimes();
            }
            
            // Save preferences
            await this.savePreferences();
        });
        }
        
        // Add reminder time button (with safeguard against duplicates)
        if (addReminderTimeButton && !addReminderTimeButton.hasAttribute('data-initialized')) {
            addReminderTimeButton.setAttribute('data-initialized', 'true');
            
            addReminderTimeButton.addEventListener('click', () => {               
                // Initialize preferences if needed
                if (!this.preferences) this.preferences = {};
                if (!this.preferences.reminder_times || !Array.isArray(this.preferences.reminder_times)) {
                    this.preferences.reminder_times = [];
                }
                
                // Add default time (9 PM)
                this.preferences.reminder_times.push('21:00');
                
                // Update UI
                this.renderReminderTimes();
                
                // Save preferences
                this.savePreferences();
            });
        }
    },
    
    // Render reminder times UI
    renderReminderTimes: function() {
        const container = document.getElementById('reminder-times');
        if (!container) {
            console.error('Reminder times container not found');
            return;
        }
                
        // Clear container
        container.innerHTML = '';
        
        // Check if we have any times to render
        if (!this.preferences || !this.preferences.reminder_times || !Array.isArray(this.preferences.reminder_times)) {
            console.warn('No reminder times to render');
            return;
        }
        
        // Add each time with edit and delete buttons
        this.preferences.reminder_times.forEach((time, index) => {
            const timeContainer = document.createElement('div');
            timeContainer.className = 'reminder-time';
            timeContainer.style.display = 'flex';
            timeContainer.style.marginBottom = '10px';
            timeContainer.style.alignItems = 'center';
            timeContainer.style.gap = '10px';
            
            const timeInput = document.createElement('input');
            timeInput.type = 'time';
            timeInput.value = time;
            timeInput.addEventListener('change', (e) => {
                this.preferences.reminder_times[index] = e.target.value;
                this.savePreferences();
            });
            
            const deleteButton = document.createElement('button');
            deleteButton.type = 'button';
            deleteButton.className = 'remove-time-btn';
            deleteButton.textContent = 'Remove';
            deleteButton.style.color = '#e53e3e';
            deleteButton.style.border = '1px solid #e53e3e';
            deleteButton.style.background = 'white';
            deleteButton.style.padding = '4px 8px';
            deleteButton.style.borderRadius = '4px';
            deleteButton.style.cursor = 'pointer';
            
            deleteButton.addEventListener('click', () => {
                this.preferences.reminder_times.splice(index, 1);
                this.renderReminderTimes();
                this.savePreferences();
            });
            
            timeContainer.appendChild(timeInput);
            timeContainer.appendChild(deleteButton);
            container.appendChild(timeContainer);
        });
    },
    
    // Show message if notifications are not supported
    showNotSupportedMessage: function(message) {
        // Check if an error message already exists to prevent duplicates
        if (document.querySelector('.notification-error')) {
            return; // Don't add another error message
        }
        
        // Remove checkbox functionalities
        const checkbox = document.getElementById('enable-notifications');
        if (checkbox) {
            checkbox.disabled = true;
            checkbox.checked = false;
        }
        
        // Hide settings
        const container = document.getElementById('notification-settings');
        if (container) {
            container.style.display = 'none';
        }
        
        // Show single error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notification-error';
        errorDiv.style.color = '#e53e3e';
        errorDiv.style.padding = '10px';
        errorDiv.style.marginTop = '10px';
        errorDiv.textContent = message || 'Push notifications are not supported in your browser.';
        
        // Insert after checkbox label
        const label = document.querySelector('label[for="enable-notifications"]');
        if (label && label.parentNode) {
            label.parentNode.insertBefore(errorDiv, label.nextSibling);
        }
    },
    
    // Show message if notifications permission is denied
    showPermissionDeniedMessage: function() {
        const container = document.getElementById('notification-settings');
        if (!container) return;
        
        // Check if message already exists
        if (document.querySelector('.permission-denied-message')) return;
        
        const message = document.createElement('div');
        message.className = 'permission-denied-message';
        message.innerHTML = 'Notification permission is denied. Please enable notifications in your browser settings to receive reminders.';
        message.style.color = '#e53e3e';
        message.style.marginTop = '10px';
        
        container.parentNode.insertBefore(message, container);
    },
    
    // Utility: Convert base64 to Uint8Array for VAPID key
    urlBase64ToUint8Array: function(base64String) {
        if (!base64String) {
            console.error('No VAPID key provided');
            return new Uint8Array();
        }
               
        // The padding calculation is crucial for proper decoding
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        try {
            const rawData = window.atob(base64);
            const outputArray = new Uint8Array(rawData.length);
            
            for (let i = 0; i < rawData.length; i++) {
                outputArray[i] = rawData.charCodeAt(i);
            }
            
            return outputArray;
        } catch (error) {
            console.error('Error processing VAPID key:', error);
            throw error;
        }
    }
};

// Initialize on page load if on profile page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize push notifications on profile page
    if (document.getElementById('enable-notifications')) {
        CRAPP.pushNotifications.init();
    }
});