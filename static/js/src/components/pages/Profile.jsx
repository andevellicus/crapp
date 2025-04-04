export default function Profile() {
    const [formData, setFormData] = React.useState({
      first_name: '',
      last_name: '',
      email: '',
      current_password: '',
      new_password: '',
      confirm_password: ''
    });
    
    const [notificationPrefs, setNotificationPrefs] = React.useState({
      pushEnabled: false,
      emailEnabled: false,
      reminderTimes: ['20:00']
    });
    
    const [isLoading, setIsLoading] = React.useState(true);
    const [isSaving, setIsSaving] = React.useState(false);
    const [errorMessage, setErrorMessage] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);
    const [deleteConfirmation, setDeleteConfirmation] = React.useState('');
    const [deletePassword, setDeletePassword] = React.useState('');
    
    const { user } = useAuth();
    
    // Load user data on component mount
    React.useEffect(() => {
      if (user) {
        setFormData({
          ...formData,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || ''
        });
        
        fetchNotificationPreferences();
      }
      setIsLoading(false);
    }, [user]);
    
    // Fetch notification preferences
    const fetchNotificationPreferences = async () => {
      try {
        const response = await fetch('/api/push/preferences', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        });
        
        if (!response.ok) {
          console.error('Failed to fetch notification preferences');
          return;
        }
        
        const data = await response.json();
        setNotificationPrefs({
          pushEnabled: data.push_enabled,
          emailEnabled: data.email_enabled,
          reminderTimes: data.reminder_times && data.reminder_times.length > 0 
            ? data.reminder_times 
            : ['20:00']
        });
      } catch (error) {
        console.error('Error fetching notification preferences:', error);
      }
    };
    
    // Handle form input changes
    const handleInputChange = (e) => {
      const { name, value } = e.target;
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    };
    
    // Handle notification preference changes
    const handlePrefChange = (e) => {
      const { name, checked } = e.target;
      setNotificationPrefs(prev => ({
        ...prev,
        [name === 'enable_notifications' ? 'pushEnabled' : 'emailEnabled']: checked
      }));
    };
    
    // Handle reminder time changes
    const handleTimeChange = (index, value) => {
      const newTimes = [...notificationPrefs.reminderTimes];
      newTimes[index] = value;
      setNotificationPrefs(prev => ({
        ...prev,
        reminderTimes: newTimes
      }));
    };
    
    // Add a new reminder time
    const addReminderTime = () => {
      setNotificationPrefs(prev => ({
        ...prev,
        reminderTimes: [...prev.reminderTimes, '20:00']
      }));
    };
    
    // Remove a reminder time
    const removeReminderTime = (index) => {
      setNotificationPrefs(prev => ({
        ...prev,
        reminderTimes: prev.reminderTimes.filter((_, i) => i !== index)
      }));
    };
    
    // Validate form before submission
    const validateForm = () => {
      // Reset error message
      setErrorMessage('');
      
      // Validate password confirmation
      if (formData.new_password && formData.new_password !== formData.confirm_password) {
        setErrorMessage('New passwords do not match');
        return false;
      }
      
      // Validate password complexity if changing
      if (formData.new_password) {
        const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/;
        if (!passwordRegex.test(formData.new_password)) {
          setErrorMessage('Password must include uppercase, lowercase, and numbers');
          return false;
        }
      }
      
      // Require current password if changing password
      if (formData.new_password && !formData.current_password) {
        setErrorMessage('Current password is required to set a new password');
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
      setErrorMessage('');
      setSuccessMessage('');
      
      // Save profile info and password
      try {
        const updateResponse = await fetch('/api/user', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            first_name: formData.first_name,
            last_name: formData.last_name,
            current_password: formData.current_password || undefined,
            new_password: formData.new_password || undefined
          })
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || 'Failed to update profile');
        }
        
        // Save notification preferences
        await saveNotificationPreferences();
        
        // Clear password fields
        setFormData(prev => ({
          ...prev,
          current_password: '',
          new_password: '',
          confirm_password: ''
        }));
        
        setSuccessMessage('Profile updated successfully');
        
        // Clear success message after delay
        setTimeout(() => {
          setSuccessMessage('');
        }, 5000);
      } catch (error) {
        console.error('Error updating profile:', error);
        setErrorMessage(error.message || 'Failed to update profile');
      } finally {
        setIsSaving(false);
      }
    };
    
    // Save notification preferences
    const saveNotificationPreferences = async () => {
      try {
        const response = await fetch('/api/push/preferences', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            push_enabled: notificationPrefs.pushEnabled,
            email_enabled: notificationPrefs.emailEnabled,
            reminder_times: notificationPrefs.reminderTimes
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to update notification preferences');
        }
      } catch (error) {
        console.error('Error saving notification preferences:', error);
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
        setErrorMessage('Please type DELETE to confirm');
        return;
      }
      
      if (!deletePassword) {
        setErrorMessage('Password is required to delete your account');
        return;
      }
      
      setIsSaving(true);
      setErrorMessage('');
      
      try {
        const response = await fetch('/api/user/delete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            password: deletePassword
          })
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete account');
        }
        
        // Show success message and redirect to login
        alert('Your account has been deleted successfully. You will be redirected to the login page.');
        
        // Clear local storage and redirect
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('device_id');
        
        window.location.href = '/login';
      } catch (error) {
        console.error('Error deleting account:', error);
        setErrorMessage(error.message || 'Failed to delete account');
      } finally {
        setIsSaving(false);
        closeDeleteModal();
      }
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
          
          {errorMessage && (
            <div className="message error" style={{ display: 'block' }}>
              {errorMessage}
            </div>
          )}
          
          {successMessage && (
            <div className="message success" style={{ display: 'block' }}>
              {successMessage}
            </div>
          )}
          
          <form className="profile-form" onSubmit={handleSubmit}>
            <div className="form-section">
              <h4>Personal Information</h4>
              
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
            
            <div className="form-section">
              <h4>Change Password</h4>
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
            
            <div className="form-section">
              <h4>Notification Preferences</h4>
              
              <div className="notification-types">
                {/* Push Notifications */}
                <div className="notification-group">
                  <div className="form-group checkbox-group">
                    <input
                      type="checkbox"
                      id="enable_notifications"
                      name="enable_notifications"
                      checked={notificationPrefs.pushEnabled}
                      onChange={handlePrefChange}
                    />
                    <label htmlFor="enable_notifications">Enable Push Notifications</label>
                  </div>
                  <div className="field-note">
                    Receive browser notifications when it's time to complete your assessment.
                  </div>
                </div>
                
                {/* Email Notifications */}
                <div className="notification-group">
                  <div className="form-group checkbox-group">
                    <input
                      type="checkbox"
                      id="enable_email_notifications"
                      name="enable_email_notifications"
                      checked={notificationPrefs.emailEnabled}
                      onChange={handlePrefChange}
                    />
                    <label htmlFor="enable_email_notifications">Enable Email Reminders</label>
                  </div>
                  <div className="field-note">
                    Receive email reminders to complete your assessment.
                  </div>
                </div>
              </div>
              
              <div id="notification-settings" style={{ marginTop: '20px' }}>
                <label>Reminder Times:</label>
                <p className="field-note">Set the times when you want to receive reminders.</p>
                
                <div id="reminder-times">
                  {notificationPrefs.reminderTimes.map((time, index) => (
                    <div key={index} style={{ display: 'flex', marginBottom: '10px', alignItems: 'center' }}>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => handleTimeChange(index, e.target.value)}
                        style={{ marginRight: '10px' }}
                      />
                      {notificationPrefs.reminderTimes.length > 1 && (
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
                
                {notificationPrefs.reminderTimes.length < 5 && (
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
            
            <div className="form-section danger-zone">
              <h4>Delete Account</h4>
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
        
        {/* Delete Account Modal */}
        {showDeleteModal && (
          <div className="modal show">
            <div className="modal-content">
              <div className="modal-header">
                <h4>Delete Account</h4>
                <button className="close-modal" onClick={closeDeleteModal}>&times;</button>
              </div>
              <div className="modal-body">
                <p className="warning-text">This action CANNOT be undone. All your data will be permanently deleted.</p>
                <p>Please type "DELETE" to confirm:</p>
                <div className="form-group">
                  <input
                    type="text"
                    value={deleteConfirmation}
                    onChange={handleDeleteConfirmationChange}
                    autoComplete="off"
                  />
                </div>
                <div className="form-group">
                  <label>Enter your password:</label>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={handleDeletePasswordChange}
                  />
                </div>
                <div className="form-actions">
                  <button type="button" className="cancel-button" onClick={closeDeleteModal}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    className="delete-button"
                    disabled={deleteConfirmation !== 'DELETE' || !deletePassword}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }