// src/components/pages/profile/NotificationForm.jsx
import React from 'react';
import { useNotifications } from '../../../context/NotificationContext'; // Adjust path as needed
import LoadingSpinner from '../../common/LoadingSpinner'; //

const NotificationForm = ({ showSectionMessage, onSave }) => {
    const {
        preferences,
        pushSupported,
        loading: notificationLoading,
        savePreferences, // Use this directly
        requestPushPermission
    } = useNotifications(); //

    // Internal handlers that use the context methods
    const handlePrefChange = async (e) => { //
        const { name, checked } = e.target; //
        const isEnablingPush = name === 'enable_notifications' && checked; //

        const currentPrefs = preferences; // Get current prefs from context
        let newPrefs = { //
            ...currentPrefs, //
            [name === 'enable_notifications' ? 'pushEnabled' : 'emailEnabled']: checked //
        }; //

        if (isEnablingPush) { //
            const success = await requestPushPermission(); //
            if (!success) { //
                newPrefs.pushEnabled = false; //
                showSectionMessage('Push notification permission was denied', 'error'); //
            } else { //
                showSectionMessage('Push notifications enabled successfully!', 'success'); //
            } //
        } //

        // Save using context method
        const saveSuccess = await savePreferences(newPrefs); //
        if (!saveSuccess) {
             showSectionMessage('Failed to save notification preferences', 'error'); //
        } else if (!isEnablingPush) {
             // Show generic success if not the push enabling flow (which shows its own message)
             showSectionMessage('Notification preferences saved', 'success'); //
        }
         // Optional: Call the onSave prop passed from parent if it needs to know
        if (saveSuccess && onSave) {
            // onSave(newPrefs); // Or just notify success
        }
    }; //

    const handleTimeChange = (index, value) => { //
        const newTimes = [...preferences.reminderTimes]; //
        newTimes[index] = value; //
        savePreferences({ ...preferences, reminderTimes: newTimes }); // Save immediately via context
    }; //

    const addReminderTime = () => { //
        if (preferences.reminderTimes.length < 5) { // Add limit check
            savePreferences({ ...preferences, reminderTimes: [...preferences.reminderTimes, '20:00'] }); //
        }
    }; //

    const removeReminderTime = (index) => { //
         if (preferences.reminderTimes.length > 1) { // Prevent removing the last one
            savePreferences({ ...preferences, reminderTimes: preferences.reminderTimes.filter((_, i) => i !== index) }); //
        }
    }; //

    if (notificationLoading) {
        return <LoadingSpinner message="Loading preferences..." />;
    }

    return (
        <>
            <div className="notification-types"> 
                {/* Push Notifications */}
                <div className="notification-group"> 
                    <div className="form-group checkbox-group"> 
                        <input
                            type="checkbox"
                            id="enable_notifications"
                            name="enable_notifications"
                            checked={preferences.pushEnabled} //
                            onChange={handlePrefChange} //
                            disabled={!pushSupported} //
                        /> 
                        <label htmlFor="enable_notifications" style={!pushSupported ? { color: '#999' } : {}}> 
                            Enable Push Notifications 
                        </label> 
                    </div> 
                     <div className="field-note"> 
                        Receive browser notifications when it's time to complete your assessment. 
                    </div> 
                    {!pushSupported && ( //
                        <div style={{ color: '#e53e3e', padding: '10px', marginTop: '10px' }}> 
                           Push notifications are not supported or enabled in your browser. 
                        </div> //
                    )} 
                </div> 

                {/* Email Notifications */}
                 <div className="notification-group"> 
                    <div className="form-group checkbox-group"> 
                        <input
                            type="checkbox"
                            id="enable_email_notifications"
                            name="enable_email_notifications"
                            checked={preferences.emailEnabled} //
                            onChange={handlePrefChange} //
                        /> 
                        <label htmlFor="enable_email_notifications">Enable Email Reminders</label> 
                    </div> 
                     <div className="field-note"> 
                        Receive email reminders to complete your assessment. 
                    </div> 
                </div> 
            </div> 

            <div id="notification-settings" style={{ marginTop: '20px', display: (preferences.pushEnabled || preferences.emailEnabled) ? 'block' : 'none' }}> 
                <label>Reminder Times:</label> 
                 <p className="field-note">Set the times (in your local timezone) when you want to receive reminders.</p> 

                <div id="reminder-times"> 
                    {preferences.reminderTimes.map((time, index) => ( //
                        <div key={index} style={{ display: 'flex', marginBottom: '10px', alignItems: 'center' }}> 
                            <input
                                type="time"
                                value={time} //
                                onChange={(e) => handleTimeChange(index, e.target.value)} //
                                style={{ marginRight: '10px', maxWidth: '150px' }} //
                            /> 
                            {preferences.reminderTimes.length > 1 && ( //
                                <button
                                    type="button"
                                    onClick={() => removeReminderTime(index)} //
                                    className="danger-button" // Use danger style for remove
                                    style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem' }} // Smaller button
                                >
                                    Remove 
                                </button> //
                            )} 
                        </div> //
                    ))} 
                </div> 

                {preferences.reminderTimes.length < 5 && ( //
                     <button
                        type="button"
                        onClick={addReminderTime} //
                        className="button" // Use standard button style
                        style={{ width: 'auto', padding: '5px 10px', fontSize: '0.8rem', marginTop: '10px' }} // Smaller button
                    >
                        Add Reminder Time 
                    </button> //
                )} 
            </div> 
        </>
    );
};

export default NotificationForm;