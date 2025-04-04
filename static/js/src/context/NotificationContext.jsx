// Notification context for managing app notifications
const NotificationContext = React.createContext();

export default function NotificationProvider({ children }) {
  const [preferences, setPreferences] = React.useState({
    pushEnabled: false,
    emailEnabled: false,
    reminderTimes: ['20:00']
  });
  
  React.useEffect(() => {
    // Load preferences from API
    fetchPreferences();
  }, []);
  
  const fetchPreferences = async () => {
    try {
      const response = await fetch('/api/push/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPreferences({
          pushEnabled: data.push_enabled,
          emailEnabled: data.email_enabled,
          reminderTimes: data.reminder_times || ['20:00']
        });
      }
    } catch (error) {
      console.error('Error loading notification preferences:', error);
    }
  };
  
  const savePreferences = async (newPreferences) => {
    try {
      const response = await fetch('/api/push/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          push_enabled: newPreferences.pushEnabled,
          email_enabled: newPreferences.emailEnabled,
          reminder_times: newPreferences.reminderTimes
        })
      });
      
      if (response.ok) {
        setPreferences(newPreferences);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      return false;
    }
  };
  
  const requestPushPermission = async () => {
    if (!('Notification' in window)) {
      return false;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };
  
  return (
    <NotificationContext.Provider value={{
      preferences,
      savePreferences,
      requestPushPermission
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

// Custom hook for using notification context
function useNotifications() {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}