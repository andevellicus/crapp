import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import api from '../../services/api';
import Modal from '../common/Modal';

export default function Profile() {
  // Section refs for scrolling
  const personalInfoRef = React.useRef(null);
  const passwordSectionRef = React.useRef(null);
  const notificationSectionRef = React.useRef(null);
  const dangerZoneRef = React.useRef(null);
  const navigate = useNavigate();

  // Section-specific message states
  const [messages, setMessages] = React.useState({
    general: { text: '', type: '' },
    personal: { text: '', type: '' },
    password: { text: '', type: '' },
    notification: { text: '', type: '' },
    danger: { text: '', type: '' }
  });

  const { 
    preferences, 
    pushSupported, 
    loading: notificationLoading, 
    savePreferences, 
    requestPushPermission 
  } = useNotifications();
  
  const [formData, setFormData] = React.useState({
    first_name: '',
    last_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  }); 
  
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
  const [deletePassword, setDeletePassword] = React.useState('');
  
  const { user } = useAuth();
  
  // Function to show a message in a specific section and scroll to it
  const showSectionMessage = (section, text, type = 'error') => {
    setMessages(prev => ({
      ...prev,
      [section]: { text, type }
    }));
    
    // Scroll to the message
    setTimeout(() => {
      scrollToSection(section);
      
      // Auto-clear success messages after 5 seconds
      if (type === 'success') {
        setTimeout(() => {
          setMessages(prev => ({
            ...prev,
            [section]: { text: '', type: '' }
          }));
        }, 5000);
      }
    }, 100);
  };
  
  // Function to scroll to a section
  const scrollToSection = (section) => {
    const refs = {
      general: null, // Top of page
      personal: personalInfoRef,
      password: passwordSectionRef,
      notification: notificationSectionRef,
      danger: dangerZoneRef
    };
    
    const ref = refs[section];
    if (ref && ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
      });
    }
  };
  
  // Clear all messages
  const clearAllMessages = () => {
    setMessages({
      general: { text: '', type: '' },
      personal: { text: '', type: '' },
      password: { text: '', type: '' },
      notification: { text: '', type: '' },
      danger: { text: '', type: '' }
    });
  };
  
  // Load user data on component mount
  React.useEffect(() => {
    if (user) {
      // Pass a function that receives the previous state (let's call it 'prevState')
      // and returns the new state object.
      setFormData(prevState => ({
        ...prevState, // Spread the previous state first
        first_name: user.first_name || '', // Then overwrite specific fields
        last_name: user.last_name || '',
        email: user.email || ''
        // The password fields from 'prevState' are automatically included
        // because we spread it first.
      }));
    }
    setIsLoading(false);
  }, [user]);
   
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle notification preference changes
  const handlePrefChange = async (e) => {
    const { name, checked } = e.target;
    const isEnablingPush = name === 'enable_notifications' && checked;
    
    // Create a new preferences object
    const newPrefs = {
      ...preferences,
      [name === 'enable_notifications' ? 'pushEnabled' : 'emailEnabled']: checked
    };
    
    // If enabling push notifications, request permission first
    if (isEnablingPush) {
      // Use context method instead of direct implementation
      const success = await requestPushPermission();
      
      if (!success) {
        newPrefs.pushEnabled = false;
        showSectionMessage('notification', 'Push notification permission was denied', 'error');
      } else {
        showSectionMessage('notification', 'Push notifications enabled successfully!', 'success');
      }
    }
    
    // Save via context
    await savePreferences(newPrefs);
  };
  
  // Handle reminder time changes
  const handleTimeChange = (index, value) => {
    const newTimes = [...preferences.reminderTimes];
    newTimes[index] = value;
    // Use spread to create a new object reference for React
    savePreferences({
      ...preferences,
      reminderTimes: newTimes
    });
  };
  
  // Add a new reminder time
  const addReminderTime = () => {
    savePreferences({
      ...preferences,
      reminderTimes: [...preferences.reminderTimes, '20:00']
    });
  };
  
  // Remove a reminder time
  const removeReminderTime = (index) => {
    savePreferences({
      ...preferences,
      reminderTimes: preferences.reminderTimes.filter((_, i) => i !== index)
    });
  };
  
  // Validate form before submission
  const validateForm = () => {
    // Reset all error messages
    clearAllMessages();
    
    // Validate personal info
    if (!formData.first_name || !formData.last_name) {
      showSectionMessage('personal', 'Name fields are required', 'error');
      return false;
    }
    
    // Validate password confirmation
    if (formData.new_password && formData.new_password !== formData.confirm_password) {
      showSectionMessage('password', 'New passwords do not match', 'error');
      return false;
    }
    
    // Validate password complexity if changing
    if (formData.new_password) {
      const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
      if (!passwordRegex.test(formData.new_password)) {
        showSectionMessage('password', 'Password must include uppercase, lowercase, and numbers', 'error');
        return false;
      }
    }
    
    // Require current password if changing password
    if (formData.new_password && !formData.current_password) {
      showSectionMessage('password', 'Current password is required to set a new password', 'error');
      return false;
    }
    
    return true;
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSaving(true);
    clearAllMessages();
    
    // Save profile info and password
    try {
      const userData = await api.put('/api/user', {
        first_name: formData.first_name,
        last_name: formData.last_name,
        current_password: formData.current_password || undefined,
        new_password: formData.new_password || undefined
      })

      // Show success for profile update
      showSectionMessage('personal', 'Profile information updated successfully', 'success');
      
      // If password was changed, show success message
      if (formData.new_password) {
        showSectionMessage('password', 'Password updated successfully', 'success');
        
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          current_password: '',
          new_password: '',
          confirm_password: ''
        }));
      }
      
      // Save notification preferences
      await saveNotificationPreferences();
      
    } catch (error) {
      console.error('Error updating profile:', error);

      // Determine which section has the error
      if (error.data && error.data.error && 
          error.data.error.toLowerCase().includes('password')) {
        showSectionMessage('password', error.data.error, 'error');
      } else {
        showSectionMessage('personal', 
          error.data?.error || error.message || 'Failed to update profile', 
          'error');
      }
    } finally {
      setIsSaving(false);
    }
  };
  
  // Save notification preferences
  const saveNotificationPreferences = async () => {
    try {
      // Just use the context method
      const success = await savePreferences({
        pushEnabled: preferences.pushEnabled,
        emailEnabled: preferences.emailEnabled,
        reminderTimes: preferences.reminderTimes
      });
      
      if (success) {
        if (preferences.pushEnabled || preferences.emailEnabled) {
          showSectionMessage(
            'notification', 
            'Notification preferences saved. You will receive reminders at your selected times.', 
            'success'
          );
        } else {
          showSectionMessage(
            'notification', 
            'Notification preferences saved. All notifications are disabled.', 
            'success'
          );
        }
      }
    } catch (error) {
      showSectionMessage(
        'notification',
        error.message || 'Failed to save notification preferences',
        'error'
      );
      throw error;
    }
  };
  
  // Handle delete account button
  const handleDeleteAccountClick = () => {
    setShowDeleteModal(true);
  };
  
  // Handle delete confirmation input
  const handleDeleteConfirmationChange = (e) => {
    setDeleteConfirmation(e.target.value);
  };
  
  // Handle delete password input
  const handleDeletePasswordChange = (e) => {
    setDeletePassword(e.target.value);
  };
  
  // Close delete modal
  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setDeleteConfirmation('');
    setDeletePassword('');
  };
  
  // Handle account deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE') {
      showSectionMessage('danger', 'Please type DELETE to confirm', 'error');
      return;
    }
    
    if (!deletePassword) {
      showSectionMessage('danger', 'Password is required to delete your account', 'error');
      return;
    }
    
    setIsSaving(true);
    clearAllMessages();
    
    try {
      await api.put('/api/user/delete', {
        password: deletePassword
      })
      
      // Show success message and redirect to login
      alert('Your account has been deleted successfully. You will be redirected to the login page.');
      
      // Clear local storage and redirect
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
      localStorage.removeItem('device_id');
      
      navigate('/login');
    } catch (error) {
      console.error('Error deleting account:', error);
      showSectionMessage('danger', error.message || 'Failed to delete account', 'error');
    } finally {
      setIsSaving(false);
      closeDeleteModal();
    }
  };
  
  // Message rendering component
  const SectionMessage = ({ message }) => {
    if (!message.text) return null;
    
    return (
      <div className={`message ${message.type}`} style={{ display: 'block', marginBottom: '15px' }}>
        {message.text}
      </div>
    );
  };
  
  if (isLoading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
        <p>Loading profile...</p>
      </div>
    );
  }
  
  return (
    <div className="profile-container">
      <div className="profile-sidebar">
        <div className="profile-nav">
          <a href="/profile" className="profile-nav-item active">Account Settings</a>
          <a href="/devices" className="profile-nav-item">Devices</a>
        </div>
      </div>
      
      <div className="profile-content">
        <h3>Account Settings</h3>
        
        {/* General messages appear at the top */}
        <SectionMessage message={messages.general} />
        
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-section" ref={personalInfoRef}>
            <h4>Personal Information</h4>
            
            {/* Personal info section messages */}
            <SectionMessage message={messages.personal} />
            
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="first_name">First Name</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="last_name">Last Name</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                readOnly
                className="readonly-field"
              />
              <div className="field-note">Email address cannot be changed</div>
            </div>
          </div>
          
          <div className="form-section" ref={passwordSectionRef}>
            <h4>Change Password</h4>
            
            {/* Password section messages */}
            <SectionMessage message={messages.password} />
            
            <div className="form-group">
              <label htmlFor="current_password">Current Password</label>
              <input
                type="password"
                id="current_password"
                name="current_password"
                value={formData.current_password}
                onChange={handleInputChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="new_password">New Password</label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                value={formData.new_password}
                onChange={handleInputChange}
                minLength="8"
                pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}"
              />
              <div className="password-requirements">
                Passwords must be at least 8 characters long and include uppercase letters, 
                lowercase letters, and numbers.
              </div>
            </div>
            
            <div className="form-group">
              <label htmlFor="confirm_password">Confirm New Password</label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={formData.confirm_password}
                onChange={handleInputChange}
              />
            </div>
            <div className="field-note">Leave password fields empty if you don't want to change your password</div>
          </div>
          
          <div className="form-section" ref={notificationSectionRef}>
            <h4>Notification Preferences</h4>
            
            {/* Notification section messages */}
            <SectionMessage message={messages.notification} />
            
            <div className="notification-types">
              {/* Push Notifications */}
              <div className="notification-group">
                <div className="form-group checkbox-group">
                  <input
                    type="checkbox"
                    id="enable_notifications"
                    name="enable_notifications"
                    checked={preferences.pushEnabled}
                    onChange={handlePrefChange}
                    disabled={!pushSupported}
                  />
                  <label htmlFor="enable_notifications" style={!pushSupported ? {color: '#999'} : {}}>
                    Enable Push Notifications
                  </label>
                </div>
                <div className="field-note">
                  Receive browser notifications when it's time to complete your assessment.
                </div>
                {!pushSupported && (
                  <div style={{color: '#e53e3e', padding: '10px', marginTop: '10px'}}>
                    Push notifications are not supported in your browser.
                    <div style={{marginTop: '10px', color: '#2f855a'}}>
                      However, you can still use email notifications.
                    </div>
                  </div>
                )}
              </div>
              
              {/* Email Notifications */}
              <div className="notification-group">
                <div className="form-group checkbox-group">
                  <input
                    type="checkbox"
                    id="enable_email_notifications"
                    name="enable_email_notifications"
                    checked={preferences.emailEnabled}
                    onChange={handlePrefChange}
                  />
                  <label htmlFor="enable_email_notifications">Enable Email Reminders</label>
                </div>
                <div className="field-note">
                  Receive email reminders to complete your assessment.
                </div>
              </div>
            </div>
            
            <div id="notification-settings" style={{ 
              marginTop: '20px', 
              display: (preferences.pushEnabled || preferences.emailEnabled) ? 'block' : 'none' 
            }}>
              <label>Reminder Times:</label>
              <p className="field-note">Set the times when you want to receive reminders.</p>
              
              <div id="reminder-times">
                {preferences.reminderTimes.map((time, index) => (
                  <div key={index} style={{ display: 'flex', marginBottom: '10px', alignItems: 'center' }}>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => handleTimeChange(index, e.target.value)}
                      style={{ marginRight: '10px' }}
                    />
                    {preferences.reminderTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeReminderTime(index)}
                        style={{ 
                          backgroundColor: '#e53e3e', 
                          color: 'white', 
                          border: 'none', 
                          padding: '5px 10px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          width: 'auto'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {preferences.reminderTimes.length < 5 && (
                <button
                  type="button"
                  onClick={addReminderTime}
                  style={{ 
                    backgroundColor: '#4a6fa5', 
                    color: 'white', 
                    border: 'none', 
                    padding: '5px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    marginTop: '10px',
                    width: 'auto'
                  }}
                >
                  Add Reminder Time
                </button>
              )}
            </div>
          </div>
          
          <div className="form-actions">
            <button type="submit" className="submit-button" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
          
          <div className="form-section danger-zone" ref={dangerZoneRef}>
            <h4>Delete Account</h4>
            
            {/* Danger section messages */}
            <SectionMessage message={messages.danger} />
            
            <p className="warning-text">This action cannot be undone. All your data will be permanently deleted.</p>
            <button
              type="button"
              onClick={handleDeleteAccountClick}
              className="danger-button"
              disabled={isSaving}
            >
              Delete My Account
            </button>
          </div>
        </form>
      </div>
      
      {/* Delete Account Modal using the reusable component */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeDeleteModal}
        title="Delete Account"
        footer={
          <> {/* Use Fragment shorthand for multiple elements */}
            <button type="button" className="cancel-button" onClick={closeDeleteModal}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteAccount}
              className="delete-button" // Use specific class for delete button
              disabled={deleteConfirmation !== 'DELETE' || !deletePassword || isSaving}
            >
              {isSaving ? 'Deleting...' : 'Delete Account'}
            </button>
          </>
        }
      >
        {/* Content for the modal body */}
        <p className="warning-text">This action CANNOT be undone. All your data will be permanently deleted.</p>
        <div className="form-group">
          <label htmlFor="delete-confirm">Please type "DELETE" to confirm:</label>
          <input
            type="text"
            id="delete-confirm" // Add id for label association
            value={deleteConfirmation}
            onChange={handleDeleteConfirmationChange}
            autoComplete="off"
          />
        </div>
        <div className="form-group">
          <label htmlFor="delete-password">Enter your password:</label>
          <input
            type="password"
            id="delete-password" // Add id for label association
            value={deletePassword}
            onChange={handleDeletePasswordChange}
          />
        </div>
        {/* You could add specific modal error messages here if needed */}
      </Modal>
    </div>
  );
}