import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const [preferences, setPreferences] = useState({
    pushEnabled: false,
    emailEnabled: false,
    reminderTimes: ['20:00']
  });
  const [pushSupported, setPushSupported] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get authentication status and loading state from AuthContext
  const { isAuthenticated, loading: authLoading } = useAuth();
  
  useEffect(() => {
    // Check if push notifications are supported (can run regardless of auth status)
    const isPushSupported = 'Notification' in window &&
                           'serviceWorker' in navigator &&
                           'PushManager' in window;
    setPushSupported(isPushSupported);

    // Wait until AuthContext has determined the authentication status
    if (!authLoading) {
      if (isAuthenticated) {
        // If authenticated, fetch preferences
        fetchPreferences();
      } else {
        // If not authenticated, we're done loading for this context
        setLoading(false);
        // Optionally reset preferences to default if user logs out
        setPreferences({
          pushEnabled: false,
          emailEnabled: false,
          reminderTimes: ['20:00']
        });
      }
    }
    // Dependency array now includes auth state
  }, [isAuthenticated, authLoading]);
  
  const fetchPreferences = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/push/preferences');
      
      setPreferences({
        pushEnabled: data.push_enabled,
        emailEnabled: data.email_enabled,
        reminderTimes: data.reminder_times || ['20:00']
      });
    } catch (error) {
      console.error('Error loading notification preferences:', error);
      // Set default preferences
      setPreferences({ pushEnabled: false, emailEnabled: false, reminderTimes: ['20:00'] });
    } finally {
      setLoading(false);
    }
  };
  
  const savePreferences = async (newPreferences) => {
    try {
      // Make sure user is still authenticated before saving
      if (!isAuthenticated) {
         console.warn("Attempted to save preferences while not authenticated.");
         return false;
      }
      await api.put('/api/push/preferences', {
        push_enabled: newPreferences.pushEnabled,
        email_enabled: newPreferences.emailEnabled,
        reminder_times: newPreferences.reminderTimes
      });

      setPreferences(newPreferences);
      return true;
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      return false;
    }
  };
  
  const requestPushPermission = async () => {
    if (!pushSupported) {
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        if (!isAuthenticated) {
          console.warn("Attempted to request push permission while not authenticated.");
          return false;
        }  

        // Get service worker registration
        const registration = await navigator.serviceWorker.ready;
        
        // Get VAPID public key
        const response = await api.get('/api/push/vapid-public-key');
        const publicKey = response.publicKey;
        
        if (!publicKey) {
          throw new Error('No VAPID public key available');
        }
        
        // Convert public key to Uint8Array
        const convertedKey = urlBase64ToUint8Array(publicKey);
        
        // Subscribe to push service
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedKey
        });
        
        // Send subscription to server
        await api.post('/api/push/subscribe', subscription);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error requesting push permission:', error);
      return false;
    }
  };
  
  // Helper function to convert base64 to Uint8Array
  const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    
    return outputArray;
  };
  
  return (
    <NotificationContext.Provider value={{
      preferences,
      pushSupported,
      loading,
      fetchPreferences,
      savePreferences,
      requestPushPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

export default NotificationContext;