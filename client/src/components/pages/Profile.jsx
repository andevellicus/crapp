// src/components/pages/Profile.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Added useState
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext'; // Keep for direct use or pass down
import api from '../../services/api';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner'; // Import LoadingSpinner

// Import new section components
import PersonalInfoForm from './profile/PersonalInfoForm';
import PasswordForm from './profile/PasswordForm';
import NotificationForm from './profile/NotificationForm';
import DangerZone from './profile/DangerZone';
import DevicesSection from './profile/DevicesSection';

// Message component (can be reused or kept inline)
const SectionMessage = ({ message }) => { 
    if (!message?.text) return null; 
    return ( 
        <div className={`message ${message.type}`} style={{ display: 'block', marginBottom: '15px' }}> 
            {message.text} 
        </div> 
    ); 
}; 


export default function Profile() {
    const { user, logout } = useAuth(); 
    // Keep notification context hook here if NotificationForm doesn't use it directly
    const { savePreferences: saveNotificationPreferences } = useNotifications(); // Only need save function here

    // --- State ---
    const [activeSection, setActiveSection] = useState('personal'); // Default section
    const [formData, setFormData] = useState({ 
        first_name: '',
        last_name: '',
        email: '',
        current_password: '',
        new_password: '',
        confirm_password: ''
    });
    const [messages, setMessages] = useState({ 
        // Keep separate messages for each potential section/area
        personal: { text: '', type: '' },
        password: { text: '', type: '' },
        notification: { text: '', type: '' },
        danger: { text: '', type: '' }
    });
    const [isLoading, setIsLoading] = useState(true); 
    const [isSaving, setIsSaving] = useState(false); 
    const [showDeleteModal, setShowDeleteModal] = useState(false); 
    const [deleteConfirmation, setDeleteConfirmation] = useState(''); 
    const [deletePassword, setDeletePassword] = useState(''); 

    // Refs for potential scrolling (though less needed now)
    const sectionRefs = { // Keep refs if needed for scrolling on save error
        personal: useRef(null),
        password: useRef(null),
        notification: useRef(null),
        danger: useRef(null)
    };

    // --- Effects ---
    useEffect(() => { 
        if (user) { 
            setFormData(prevState => ({ 
                ...prevState, 
                first_name: user.first_name || '', 
                last_name: user.last_name || '', 
                email: user.email || '' 
            })); 
        } 
        setIsLoading(false); 
    }, [user]); 

    // --- Handlers ---
    const handleInputChange = (e) => { 
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value })); 
        // Clear relevant message on input change if needed
        const section = e.target.closest('.form-section')?.dataset.section;
        if (section && messages[section]?.text) {
            clearSectionMessage(section);
        }
    }; 

     const showSectionMessage = useCallback((section, text, type = 'error') => { 
        setMessages(prev => ({ ...prev, [section]: { text, type } })); 

        // Scroll to section on error/success
        setTimeout(() => { 
            const ref = sectionRefs[section]; 
            if (ref?.current) { //
                ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); 
            } 
             // Auto-clear success messages
            if (type === 'success') { 
                setTimeout(() => clearSectionMessage(section), 5000); 
            } 
        }, 100); 
    }, []); 

    const clearSectionMessage = (section) => { // Helper to clear specific message
         setMessages(prev => ({ ...prev, [section]: { text: '', type: '' } }));
    };

    const clearAllMessages = () => { 
        setMessages({ //
            personal: { text: '', type: '' }, 
            password: { text: '', type: '' }, 
            notification: { text: '', type: '' }, 
            danger: { text: '', type: '' } 
        }); 
    }; 

    const validateForm = () => { 
        clearAllMessages(); 
        let isValid = true;

        if (!formData.first_name || !formData.last_name) { 
            showSectionMessage('personal', 'Name fields are required', 'error'); 
            isValid = false; 
        } 

        if (formData.new_password && formData.new_password !== formData.confirm_password) { 
            showSectionMessage('password', 'New passwords do not match', 'error'); 
            isValid = false; 
        } 

        if (formData.new_password) { 
            const passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}$/; 
            if (!passwordRegex.test(formData.new_password)) { 
                showSectionMessage('password', 'Password must include uppercase, lowercase, and numbers', 'error'); 
                isValid = false; 
            } 
        } 

        if (formData.new_password && !formData.current_password) { 
            showSectionMessage('password', 'Current password is required to set a new password', 'error'); 
            isValid = false; 
        } 

        return isValid; 
    }; 

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        if (!validateForm()) return; 

        setIsSaving(true); 
        clearAllMessages(); 

        try {
            // API call remains similar, sending only necessary fields
             await api.put('/api/user', { 
                first_name: formData.first_name, 
                last_name: formData.last_name, 
                current_password: formData.current_password || undefined, // Send only if provided
                new_password: formData.new_password || undefined // Send only if provided
            }); 

            showSectionMessage('personal', 'Profile information updated successfully', 'success'); 

            if (formData.new_password) { 
                showSectionMessage('password', 'Password updated successfully', 'success'); 
                setFormData(prev => ({ 
                    ...prev,
                    current_password: '', new_password: '', confirm_password: '' 
                })); 
            } 

        } catch (error) { 
            console.error('Error updating profile:', error); 
            const errorMsg = error.data?.error || error.message || 'Failed to update profile'; 
            // Determine which section gets the error based on error content
            if (errorMsg.toLowerCase().includes('password')) { 
                 showSectionMessage('password', errorMsg, 'error'); 
            } else { 
                 showSectionMessage('personal', errorMsg, 'error'); 
            } 
        } finally { 
            setIsSaving(false); 
        } 
    }; 

    // --- Delete Account Logic (kept in parent for modal control) ---
    const handleDeleteAccountClick = () => setShowDeleteModal(true); 
    const closeDeleteModal = () => {
        setShowDeleteModal(false); 
        setDeleteConfirmation(''); 
        setDeletePassword(''); 
        clearSectionMessage('danger'); // Clear danger zone message on close
    }; 

    const handleDeleteAccount = async () => { 
         clearSectionMessage('danger'); // Clear previous danger message
        if (deleteConfirmation !== 'DELETE') { 
            showSectionMessage('danger', 'Please type DELETE to confirm', 'error'); 
            // Keep modal open
            return; 
        } 
        if (!deletePassword) { 
            showSectionMessage('danger', 'Password is required to delete your account', 'error'); 
             // Keep modal open
            return; 
        } 

        setIsSaving(true); // Use isSaving to disable modal buttons too

        try {
            await api.put('/api/user/delete', { password: deletePassword }); 
            // Logout and redirect logic (can be moved to AuthContext logout)
            alert('Account deleted successfully. Redirecting to login.'); 
            logout(); // Assuming logout is a function that clears session
        } catch (error) { 
            console.error('Error deleting account:', error); 
            // Show error INSIDE the modal if possible, or back in danger zone
             showSectionMessage('danger', error.message || 'Failed to delete account', 'error'); 
        } finally { 
            setIsSaving(false); 
            closeDeleteModal(); // Usually closed here or in success/error specifically
        } 
    }; 

    // --- Render ---
    if (isLoading) { 
        return <LoadingSpinner message="Loading profile..." />; // Use LoadingSpinner
    } 

    return (
        <div className="profile-container"> 
            {/* --- Sidebar --- */}
            <div className="profile-sidebar"> 
                <div className="profile-nav"> 
                    {/* Account Settings Links - now act as tabs */}
                    <a
                        href="#personal" // Keep href for accessibility/semantics
                        className={`profile-nav-item ${activeSection === 'personal' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveSection('personal'); }}
                    >
                        Personal Info
                    </a>
                    <a
                        href="#password"
                        className={`profile-nav-item ${activeSection === 'password' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveSection('password'); }}
                    >
                        Password
                    </a>
                    <a
                        href="#notifications"
                        className={`profile-nav-item ${activeSection === 'notifications' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveSection('notifications'); }}
                    >
                        Notifications
                    </a>
                    <a
                        href="#devices" // Keep href
                        className={`profile-nav-item ${activeSection === 'devices' ? 'active' : ''}`} // Make it activatable
                        onClick={(e) => { e.preventDefault(); setActiveSection('devices'); }} // Set active section
                    >
                        Devices
                    </a>
                    <a
                        href="#danger"
                        className={`profile-nav-item ${activeSection === 'danger' ? 'active' : ''}`}
                        onClick={(e) => { e.preventDefault(); setActiveSection('danger'); }}
                        style={{ color: activeSection === 'danger' ? 'white' : 'var(--error-color)', backgroundColor: activeSection === 'danger' ? 'var(--error-color)' : undefined }} // Style danger zone link
                    >
                        Delete Account
                    </a>
                </div>
            </div>

            {/* --- Main Content Area --- */}
            <div className="profile-content"> 
                 {/* Wrap content sections in a form for the submit button */}
                 <form className="profile-form" onSubmit={handleSubmit}> 
                    {/* Conditionally render the active section */}
                    {activeSection === 'personal' && (
                         <div ref={sectionRefs.personal} data-section="personal" className="form-section"> {/* Add ref and data-section */}
                            <h4>Personal Information</h4> 
                            <SectionMessage message={messages.personal} /> 
                            <PersonalInfoForm
                                formData={formData}
                                handleInputChange={handleInputChange}
                            />
                        </div>
                    )}

                    {activeSection === 'password' && (
                         <div ref={sectionRefs.password} data-section="password" className="form-section"> {/* Add ref and data-section */}
                            <h4>Change Password</h4> 
                            <SectionMessage message={messages.password} /> 
                            <PasswordForm
                                formData={formData}
                                handleInputChange={handleInputChange}
                            />
                        </div>
                    )}

                    {activeSection === 'notifications' && (
                         <div ref={sectionRefs.notification} data-section="notification" className="form-section"> {/* Add ref and data-section */}
                            <h4>Notification Preferences</h4> 
                            <SectionMessage message={messages.notification} /> 
                            <NotificationForm
                                showSectionMessage={(text, type) => showSectionMessage('notification', text, type)} // Pass message handler down
                                onSave={saveNotificationPreferences} // Pass the specific save function if needed
                            />
                        </div>
                    )}
                    {/* Render Devices Section outside the main form */}
                    {activeSection === 'devices' && (
                      // Pass messages if needed, or handle them internally in DevicesSection
                      <DevicesSection />
                    )}
                    {activeSection === 'danger' && (
                      <div ref={sectionRefs.danger} data-section="danger" className="form-section danger-zone"> 
                          <h4>Delete Account</h4> 
                            <SectionMessage message={messages.danger} /> 
                            <DangerZone
                                onDeleteClick={handleDeleteAccountClick} 
                                isSaving={isSaving} 
                            />
                      </div>
                    )}

                     {/* Only show save button if not in danger zone */}
                     {(activeSection !== 'danger' && activeSection !== 'devices') && (
                        <div className="form-actions"> 
                            <button type="submit" className="submit-button" disabled={isSaving}> 
                                {isSaving ? 'Saving...' : 'Save Changes'} 
                            </button> 
                        </div>
                     )}
                </form>
            </div>

            {/* Delete Account Modal (remains controlled by parent) */}
            <Modal
                isOpen={showDeleteModal} 
                onClose={closeDeleteModal} 
                title="Delete Account" 
                footer={ 
                    <> 
                        <button type="button" className="cancel-button" onClick={closeDeleteModal} disabled={isSaving}> 
                            Cancel 
                        </button> 
                        <button
                            type="button"
                            onClick={handleDeleteAccount} 
                            className="delete-button" 
                            disabled={deleteConfirmation !== 'DELETE' || !deletePassword || isSaving} 
                        >
                            {isSaving ? 'Deleting...' : 'Delete Account'} 
                        </button> 
                    </> 
                } 
            >
                 {/* <SectionMessage message={messages.danger} /> */}
                 <p className="warning-text">This action CANNOT be undone. All your data will be permanently deleted.</p> 
                <div className="form-group"> 
                    <label htmlFor="delete-confirm">Please type "DELETE" to confirm:</label> 
                    <input
                        type="text"
                        id="delete-confirm" 
                        value={deleteConfirmation} 
                        onChange={(e) => setDeleteConfirmation(e.target.value)} 
                        autoComplete="off" 
                    /> 
                </div> 
                <div className="form-group"> 
                    <label htmlFor="delete-password">Enter your password:</label> 
                    <input
                        type="password"
                        id="delete-password" 
                        value={deletePassword} 
                        onChange={(e) => setDeletePassword(e.target.value)} 
                    /> 
                </div> 
            </Modal> 
        </div>
    );
}