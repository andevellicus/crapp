// static/js/notify.js

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
                this.showNotSupportedMessage("Push notifications are not supported in your browser.");
                // Still load preferences for email notifications
                await this.loadPreferences();
                this.initUI(false);
                return false;
            }
            
            // Check for service worker support with more detail
            if (!navigator.serviceWorker) {
                console.warn('Service Workers not supported');
                this.showNotSupportedMessage("Push notifications are not supported in your browser.");
                // Still load preferences for email notifications
                await this.loadPreferences();
                this.initUI(false);
                return false;
            }
                       
            // Check for push manager with more specific error
            if (!('PushManager' in window)) {
                console.warn('Push Manager not supported');
                this.showNotSupportedMessage("Push notifications are not supported in your browser.");
                // Still load preferences for email notifications
                await this.loadPreferences();
                this.initUI(false);
                return false;
            }
            
            // Load key and preferences
            await this.getVAPIDPublicKey();
            await this.loadPreferences();
            
            // Initialize UI
            this.initUI(true);
            
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
            const response = await window.authManager.fetchWithAuth('/api/push/vapid-public-key')
                        
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
            const response = await window.authManager.fetchWithAuth('/api/push/preferences');
                        
            if (!response.ok) {
                throw new Error('Failed to load preferences');
            }
            
            this.preferences = await response.json();
            
            // Make sure preferences has all needed properties
            if (!this.preferences) {
                this.preferences = {};
            }
            
            if (!this.preferences.reminder_times || !Array.isArray(this.preferences.reminder_times)) {
                this.preferences.reminder_times = ['20:00']; // Default 8 PM
            }
            
            // Add email_enabled if not present
            if (this.preferences.email_enabled === undefined) {
                this.preferences.email_enabled = false;
            }
            
        } catch (error) {
            console.error('Error loading preferences:', error);
            // Set default preferences
            this.preferences = {
                enabled: false,
                email_enabled: false,
                reminder_times: ['20:00'] // Default 8 PM
            };
        }
    },
    
    // Save user preferences
    savePreferences: async function() {
        try {           
            // Make sure we have a valid preferences object
            if (!this.preferences) {
                this.preferences = {
                    enabled: false,
                    email_enabled: false,
                    reminder_times: ['20:00']
                };
            }
            
            const response = await window.authManager.fetchWithAuth('/api/push/preferences', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(this.preferences)
            });
            
            if (!response.ok) {
                console.error('Failed to save preferences:', response.status);
                throw new Error('Failed to save preferences');
            }
            
            console.log('Preferences saved successfully', this.preferences);
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
            const response = await window.authManager.fetchWithAuth('/api/push/subscribe', {
                method: 'POST',
                headers: {
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
    // Initialize UI
    initUI: function(pushSupported) {
        const enableNotificationsCheckbox = document.getElementById('enable-notifications');
        const enableEmailCheckbox = document.getElementById('enable-email-notifications');
        const notificationSettings = document.getElementById('notification-settings');
        const addReminderTimeButton = document.getElementById('add-reminder-time');
        
        // Disable push notification checkbox if not supported
        if (!pushSupported && enableNotificationsCheckbox) {
            enableNotificationsCheckbox.disabled = true;
            enableNotificationsCheckbox.checked = false;
            const label = document.querySelector('label[for="enable-notifications"]');
            if (label) {
                label.style.color = '#999';
            }
        }
        
        // If no notification checkboxes exist, we're not on the profile page
        if (!enableNotificationsCheckbox && !enableEmailCheckbox) {
            return;
        }
        
        // Set initial state from preferences
        if (enableNotificationsCheckbox) {
            enableNotificationsCheckbox.checked = this.preferences && this.preferences.enabled;
        }
        
        if (enableEmailCheckbox) {
            enableEmailCheckbox.checked = this.preferences && this.preferences.email_enabled;
        }

        // Make sure to show/hide the settings based on whether any notification is enabled
        if (notificationSettings) {
            const anyNotificationEnabled = 
                (enableNotificationsCheckbox && enableNotificationsCheckbox.checked) || 
                (enableEmailCheckbox && enableEmailCheckbox.checked);
                
            notificationSettings.style.display = anyNotificationEnabled ? 'block' : 'none';
        }
        
        // Render reminder times
        this.renderReminderTimes();
        
        // Add push notification checkbox event listener (with safeguard against duplicates)
        if (enableNotificationsCheckbox && !enableNotificationsCheckbox.hasAttribute('data-initialized')) {
            enableNotificationsCheckbox.setAttribute('data-initialized', 'true');
            
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
                    } else {
                        // Permission granted and subscription succeeded
                        this.preferences.enabled = true;
                    }
                } else {
                    // User unchecked the box
                    this.preferences.enabled = false;
                }
                
                // Always update UI visibility
                if (notificationSettings) {
                    const anyNotificationEnabled = 
                        (enableNotificationsCheckbox && enableNotificationsCheckbox.checked) || 
                        (enableEmailCheckbox && enableEmailCheckbox.checked);
                        
                    notificationSettings.style.display = anyNotificationEnabled ? 'block' : 'none';
                }
                
                // Always render time entries if settings are visible
                if (this.preferences.enabled || this.preferences.email_enabled) {
                    this.renderReminderTimes();
                }
                
                // Save preferences
                await this.savePreferences();
            });
        }
        
        // Add email notification checkbox event listener
        if (enableEmailCheckbox && !enableEmailCheckbox.hasAttribute('data-initialized')) {
            enableEmailCheckbox.setAttribute('data-initialized', 'true');
            
            enableEmailCheckbox.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                
                // Update preferences
                if (!this.preferences) this.preferences = {};
                if (!this.preferences.reminder_times || !Array.isArray(this.preferences.reminder_times)) {
                    this.preferences.reminder_times = ['20:00']; // Default 8 PM
                }
                
                this.preferences.email_enabled = enabled;
                
                // Update UI visibility
                if (notificationSettings) {
                    const anyNotificationEnabled = 
                        (enableNotificationsCheckbox && enableNotificationsCheckbox.checked) || 
                        (enableEmailCheckbox && enableEmailCheckbox.checked);
                        
                    notificationSettings.style.display = anyNotificationEnabled ? 'block' : 'none';
                }
                
                // Always render time entries if settings are visible
                if (this.preferences.enabled || this.preferences.email_enabled) {
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
            deleteButton.style.padding = '4px 8px';
            deleteButton.style.borderRadius = '4px';
            deleteButton.style.cursor = 'pointer';
            deleteButton.style.border = '1px solid #e53e3e';
            deleteButton.style.color = '#e53e3e';
            deleteButton.style.background = 'white';

            // Prevent removing last item
            if (this.preferences.reminder_times.length <= 1) {
                deleteButton.disabled = true;
                deleteButton.style.opacity = '0.5';
                deleteButton.style.cursor = 'not-allowed';
                deleteButton.title = 'At least one reminder time is required';
            }
            
            deleteButton.addEventListener('click', () => {
                // Prevent removing last item
                if (this.preferences.reminder_times.length <= 1) {
                    return;
                }

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
        
        // Disable push notification checkbox
        const checkbox = document.getElementById('enable-notifications');
        if (checkbox) {
            checkbox.disabled = true;
            checkbox.checked = false;
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
        
        // Add note that email notifications are still available
        const noteDiv = document.createElement('div');
        noteDiv.className = 'notification-note';
        noteDiv.style.marginTop = '10px';
        noteDiv.style.color = '#2f855a';
        noteDiv.textContent = 'However, you can still use email notifications.';
        
        // Check if email checkbox exists before adding note
        const emailCheckbox = document.getElementById('enable-email-notifications');
        if (emailCheckbox && errorDiv.parentNode) {
            errorDiv.parentNode.insertBefore(noteDiv, errorDiv.nextSibling);
        }
    },
    
    // Show message if notifications permission is denied
    showPermissionDeniedMessage: function() {
        // Check if message already exists
        if (document.querySelector('.permission-denied-message')) return;
        
        const pushCheckbox = document.getElementById('enable-notifications');
        if (pushCheckbox) {
            pushCheckbox.checked = false;
            
            // Create and insert message
            const message = document.createElement('div');
            message.className = 'permission-denied-message';
            message.innerHTML = 'Notification permission is denied. Please enable notifications in your browser settings to receive push notifications.';
            message.style.color = '#e53e3e';
            message.style.marginTop = '10px';
            
            // Insert after checkbox
            const container = pushCheckbox.closest('.notification-group');
            if (container) {
                container.appendChild(message);
            }
            
            // Add note that email notifications are still available
            const noteDiv = document.createElement('div');
            noteDiv.className = 'notification-note';
            noteDiv.style.marginTop = '5px';
            noteDiv.style.color = '#2f855a';
            noteDiv.textContent = 'You can still use email notifications.';
            
            // Check if email checkbox exists before adding note
            const emailCheckbox = document.getElementById('enable-email-notifications');
            if (emailCheckbox && message.parentNode) {
                message.parentNode.insertBefore(noteDiv, message.nextSibling);
            }
        }
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