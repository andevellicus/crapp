// Utility functions for notifications

/**
 * Convert base64 string to Uint8Array
 * This is needed for VAPID key conversion for web push notifications
 */
export const urlBase64ToUint8Array = (base64String) => {
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
  };
  
  /**
   * Check if push notifications are supported in this browser
   */
  export const isPushNotificationSupported = () => {
    return 'Notification' in window && 
           'serviceWorker' in navigator && 
           'PushManager' in window;
  };
  
  /**
   * Request permission for push notifications
   * Returns a boolean indicating if permission was granted
   */
  export const requestNotificationPermission = async () => {
    if (!isPushNotificationSupported()) {
      return false;
    }
    
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  };