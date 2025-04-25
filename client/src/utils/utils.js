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
   * Format time as MM:SS
   */
  export const formatTime = (milliseconds) => {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * Format a date as "Month Day, Year"
   */
  // 
  export const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  /**
   * Check if the current device is a mobile device
   * @returns {boolean} True if device is mobile
   */
  export const isMobileDevice = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
      (window.innerWidth <= 768);
  };

/**
 * Helper to get cookie value by name
 * @param {string} name - The name of the cookie.
 * @returns {string|null} The cookie value or null if not found.
 */
export const getCookie = (name) => { // Added export
  if (typeof document === 'undefined') { // Add check for server-side rendering if applicable
      return null;
  }
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    const cookieValue = parts.pop().split(';').shift();

    if (name === 'csrf_token') {
      return cookieValue; // Return raw value for CSRF token
    }
    // Decode the cookie value in case it contains special characters
    try {
        return decodeURIComponent(cookieValue);
    } catch (e) {
        console.error("Error decoding cookie", name, e);
        // Fallback to raw value if decoding fails
         return cookieValue 
    }
  }
  return null;
};