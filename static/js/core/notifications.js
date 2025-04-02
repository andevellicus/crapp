// static/js/core/notifications.js
window.CRAPP = window.CRAPP || {};

CRAPP.notifications = (function() {
    // Private variables
    const CHANNELS = {
        PUSH: 'push',
        EMAIL: 'email',
        BOTH: 'both'
    };
    
    const DEFAULT_TEMPLATES = {
        REMINDER: {
            title: 'Daily Assessment Reminder',
            body: 'Time to complete your daily assessment!'
        },
        SUCCESS: {
            title: 'Assessment Completed',
            body: 'Thank you for completing your assessment!'
        },
        WELCOME: {
            title: 'Welcome to CRAPP',
            body: 'Thank you for registering!'
        }
    };
    
    let vapidPublicKey = null;
    let pushSubscription = null;
    let preferences = null;
    
    // Private methods
    async function loadVAPIDPublicKey() {
        try {
            const data = await CRAPP.api.get('/api/push/vapid-public-key');
            vapidPublicKey = data.publicKey;
            return vapidPublicKey;
        } catch (error) {
            console.error('Failed to load VAPID public key:', error);
            throw error;
        }
    }
    
    async function loadPreferences() {
        try {
            preferences = await CRAPP.api.get('/api/push/preferences');
            
            // Set defaults for missing properties
            if (preferences.push_enabled === undefined) {
                preferences.push_enabled = false;
            }
            
            if (preferences.email_enabled === undefined) {
                preferences.email_enabled = false;
            }
            
            if (!preferences.reminder_times || !Array.isArray(preferences.reminder_times)) {
                preferences.reminder_times = ['20:00']; // Default 8 PM
            }
            
            return preferences;
        } catch (error) {
            console.error('Error loading notification preferences:', error);
            // Set default preferences
            preferences = {
                push_enabled: false,
                email_enabled: false,
                reminder_times: ['20:00'] // Default 8 PM
            };
            return preferences;
        }
    }
    
    async function savePreferences(updatedPreferences) {
        try {
            // Make sure we have a valid preferences object
            if (!updatedPreferences) updatedPreferences = preferences || {
                push_enabled: false,
                email_enabled: false,
                reminder_times: ['20:00']
            };
            
            // Use API service to save preferences
            await CRAPP.api.put('/api/push/preferences', updatedPreferences);
            
            // Update local preferences
            preferences = updatedPreferences;
            
            return true;
        } catch (error) {
            console.error('Error saving notification preferences:', error);
            return false;
        }
    }
    
    async function checkPushPermission() {
        if (!('Notification' in window)) {
            return false;
        }
        
        return Notification.permission === 'granted';
    }
    
    async function requestPushPermission() {
        if (!('Notification' in window)) {
            return false;
        }
        
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    async function subscribeToPush() {
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
            if (!vapidPublicKey) {
                await loadVAPIDPublicKey();
            }
            
            // Convert VAPID key to correct format
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            
            // Subscribe to push manager
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });
            
            // Save subscription to server
            const saved = await saveSubscription(subscription);
            if (!saved) {
                console.error('Failed to save subscription on server');
                return false;
            }
            
            pushSubscription = subscription;
            return true;
        } catch (error) {
            console.error('Error subscribing to push:', error);
            return false;
        }
    }
    
    async function saveSubscription(subscription) {
        try {
            // Use API service to save subscription
            await CRAPP.api.post('/api/push/subscribe', subscription);
            return true;
        } catch (error) {
            console.error('Error saving push subscription:', error);
            return false;
        }
    }
    
    // Utility: Convert base64 to Uint8Array for VAPID key
    function urlBase64ToUint8Array(base64String) {
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
    
    function formatTime(timeStr) {
        // Parse the time string to a time.Time
        try {
            const t = new Date(`1970-01-01T${timeStr}`);
            if (isNaN(t.getTime())) {
                return timeStr; // Return as-is if parsing fails
            }
            
            // Return in 24-hour format
            return t.toTimeString().substring(0, 5); // HH:MM format
        } catch (e) {
            return timeStr; // Return as-is if parsing fails
        }
    }
    
    function showNotSupportedMessage(message) {
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
    }
    
    function showPermissionDeniedMessage() {
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
    }

    function renderReminderTimes() {
        const container = document.getElementById('reminder-times');
        if (!container) return;
        
        // Clear container
        container.innerHTML = '';
        
        // Make sure preferences are loaded
        if (!preferences || !preferences.reminder_times) {
            loadPreferences().then(() => renderReminderTimes());
            return;
        }
        
        // Add each time with edit and delete buttons
        preferences.reminder_times.forEach((time, index) => {
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
                preferences.reminder_times[index] = e.target.value;
                await savePreferences(preferences);
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
            if (preferences.reminder_times.length <= 1) {
                deleteButton.disabled = true;
                deleteButton.style.opacity = '0.5';
                deleteButton.style.cursor = 'not-allowed';
                deleteButton.title = 'At least one reminder time is required';
            }
            
            deleteButton.addEventListener('click', async () => {
                // Prevent removing last item
                if (preferences.reminder_times.length <= 1) {
                    return;
                }

                preferences.reminder_times.splice(index, 1);
                await savePreferences(preferences);
                renderReminderTimes();
            });
            
            timeContainer.appendChild(timeInput);
            timeContainer.appendChild(deleteButton);
            container.appendChild(timeContainer);
        });
    }
    
    function updateNotificationUI() {
        const enableNotificationsCheckbox = document.getElementById('enable-notifications');
        const enableEmailCheckbox = document.getElementById('enable-email-notifications');
        const notificationSettings = document.getElementById('notification-settings');
        
        // Set initial state from preferences
        if (enableNotificationsCheckbox) {
            enableNotificationsCheckbox.checked = preferences.push_enabled;
        }

        if (enableEmailCheckbox) {
            enableEmailCheckbox.checked = preferences.email_enabled;
        }

        // Make sure to show/hide the settings based on whether any notification is enabled
        if (notificationSettings) {
            const anyNotificationEnabled = 
                (enableNotificationsCheckbox && enableNotificationsCheckbox.checked) || 
                (enableEmailCheckbox && enableEmailCheckbox.checked);             
            notificationSettings.style.display = anyNotificationEnabled ? 'block' : 'none';
        }
        
        // Render reminder times
        renderReminderTimes();
    }
    
    function initUI(pushSupported) {
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
        updateNotificationUI();
        
        // Add push notification checkbox event listener
        if (enableNotificationsCheckbox && !enableNotificationsCheckbox.hasAttribute('data-initialized')) {
            enableNotificationsCheckbox.setAttribute('data-initialized', 'true');
            
            enableNotificationsCheckbox.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                
                // Update preferences structure
                if (!preferences) preferences = await loadPreferences();
                
                if (enabled) {
                    // Request permission when user enables notifications
                    const permissionGranted = await requestPushPermission();
                    
                    // If permission was denied or subscription failed
                    if (!permissionGranted) {
                        console.warn('Permission denied or subscription failed');
                        e.target.checked = false;
                        preferences.push_enabled = false;
                    } else {
                        // Permission granted, now subscribe
                        const subscribed = await subscribeToPush();
                        if (!subscribed) {
                            console.warn('Failed to subscribe to push notifications');
                            e.target.checked = false;
                            preferences.push_enabled = false;
                        } else {
                            // Successfully subscribed
                            preferences.push_enabled = true;
                        }
                    }
                } else {
                    // User unchecked the box
                    preferences.push_enabled = false;
                }
                
                // Update UI visibility
                updateNotificationUI();
                
                // Save preferences
                await savePreferences(preferences);
            });
        }
        
        // Add email notification checkbox event listener
        if (enableEmailCheckbox && !enableEmailCheckbox.hasAttribute('data-initialized')) {
            enableEmailCheckbox.setAttribute('data-initialized', 'true');
            
            enableEmailCheckbox.addEventListener('change', async (e) => {
                const enabled = e.target.checked;
                
                // Update preferences
                if (!preferences) preferences = await loadPreferences();
                preferences.email_enabled = enabled;
                
                // Update UI visibility
                updateNotificationUI();
                
                // Save preferences
                await savePreferences(preferences);
            });
        }
        
        // Add reminder time button (with safeguard against duplicates)
        if (addReminderTimeButton && !addReminderTimeButton.hasAttribute('data-initialized')) {
            addReminderTimeButton.setAttribute('data-initialized', 'true');
            
            addReminderTimeButton.addEventListener('click', async () => {               
                // Initialize preferences if needed
                if (!preferences) preferences = await loadPreferences();
                
                // Add default time (9 PM)
                preferences.reminder_times.push('21:00');
                
                // Update UI
                renderReminderTimes();
                
                // Save preferences
                await savePreferences(preferences);
            });
        }
    }
    
    // Public interface
    return {
        // Channel constants
        CHANNELS: CHANNELS,
        
        // Template constants
        TEMPLATES: DEFAULT_TEMPLATES,
        
        // Initialize the notification system
        initialize: async function() {
            try {
                // Check notification support
                const pushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
                
                // Load VAPID key if push is supported
                if (pushSupported) {
                    try {
                        await loadVAPIDPublicKey();
                    } catch (error) {
                        console.warn('Failed to load VAPID key:', error);
                    }
                } else {
                    showNotSupportedMessage("Push notifications are not supported in your browser.");
                }
                
                // Load preferences
                await loadPreferences();
                
                // Initialize UI
                initUI(pushSupported);
                
                // Check notification permission if push is enabled
                if (pushSupported && preferences.push_enabled) {
                    const permission = await checkPushPermission();
                    if (permission === false) {
                        showPermissionDeniedMessage();
                        
                        // Update preferences
                        preferences.push_enabled = false;
                        await savePreferences(preferences);
                    }
                }
                
                return preferences;
            } catch (error) {
                console.error('Error initializing push notifications:', error);
                showNotSupportedMessage("Error initializing notifications: " + error.message);
                return false;
            }
        },
        
        // Get current notification preferences
        getPreferences: async function() {
            if (!preferences) {
                await loadPreferences();
            }
            return preferences;
        },
        
        // Save notification preferences
        savePreferences: savePreferences,
        
        // Check if notifications are supported and enabled
        isEnabled: async function(channel = CHANNELS.BOTH) {
            if (!preferences) {
                await loadPreferences();
            }
            
            switch(channel) {
                case CHANNELS.PUSH:
                    return preferences.push_enabled && await checkPushPermission();
                case CHANNELS.EMAIL:
                    return preferences.email_enabled;
                case CHANNELS.BOTH:
                default:
                    return (preferences.push_enabled && await checkPushPermission()) || 
                           preferences.email_enabled;
            }
        },
        
        // Send notification through available channels
        send: async function(template, data = {}, channel = CHANNELS.BOTH) {
            if (!preferences) {
                await loadPreferences();
            }
            
            let result = { push: false, email: false };
            
            // Determine template content
            let templateContent = DEFAULT_TEMPLATES[template] || {
                title: data.title || 'CRAPP Notification',
                body: data.body || 'You have a notification from CRAPP'
            };
            
            // Merge template with custom data
            const content = {
                ...templateContent,
                ...data
            };
            
            // Send push notification if enabled and requested
            if ((channel === CHANNELS.PUSH || channel === CHANNELS.BOTH) && 
                preferences.push_enabled && await checkPushPermission()) {
                try {
                    // Show local notification if supported
                    if ('Notification' in window) {
                        const notification = new Notification(content.title, {
                            body: content.body,
                            icon: '/static/icons/icon-192x192.png',
                            badge: '/static/icons/badge-96x96.png',
                            data: { url: content.url || '/' }
                        });
                        
                        // Handle notification click
                        notification.onclick = function() {
                            window.focus();
                            if (content.url) {
                                window.location.href = content.url;
                            }
                            notification.close();
                        };
                        
                        result.push = true;
                    }
                } catch (error) {
                    console.error('Error showing push notification:', error);
                }
            }
            
            // Send email notification if enabled and requested
            if ((channel === CHANNELS.EMAIL || channel === CHANNELS.BOTH) && 
                preferences.email_enabled) {
                try {
                    // Use API to request email notification from server
                    await CRAPP.api.post('/api/notifications/email', {
                        template: template,
                        data: content
                    });
                    
                    result.email = true;
                } catch (error) {
                    console.error('Error sending email notification:', error);
                }
            }
            
            return result;
        },
        
        // Schedule notification(s)
        schedule: async function(template, time, data = {}, channel = CHANNELS.BOTH) {
            try {
                const result = await CRAPP.api.post('/api/notifications/schedule', {
                    template: template,
                    time: time,
                    data: data,
                    channel: channel
                });
                
                return result;
            } catch (error) {
                console.error('Error scheduling notification:', error);
                return false;
            }
        },
        
        // Request permission for push notifications
        requestPermission: requestPushPermission,
        
        // Initialize UI
        initUI: initUI,
        
        // Render reminder times
        renderReminderTimes: renderReminderTimes,
        
        // Show error messages
        showNotSupportedMessage: showNotSupportedMessage,
        showPermissionDeniedMessage: showPermissionDeniedMessage,
        
        // Get VAPID public key
        getVAPIDPublicKey: function() {
            return vapidPublicKey;
        },
        
        // Utility functions
        urlBase64ToUint8Array: urlBase64ToUint8Array,
        
        // Update notification UI
        updateNotificationUI: updateNotificationUI
    };
})();

// Initialize on page load if on profile page
document.addEventListener('DOMContentLoaded', function() {
    // Initialize notifications if on profile page
    if (document.getElementById('enable-notifications')) {
        CRAPP.notifications.initialize();
    }
});