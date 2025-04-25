// src/components/pages/profile/DevicesSection.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext'; // Adjust path if needed
import api from '../../../services/api'; //
import { formatDate } from '../../../utils/utils'; //
import Modal from '../../common/Modal'; //
import LoadingSpinner from '../../common/LoadingSpinner'; //

// Simple component to display messages locally within this section
const DeviceMessage = ({ message, type }) => {
    if (!message) return null;
    return (
        <div className={`message ${type}`} style={{ display: 'block', marginBottom: '15px' }}>
            {message}
        </div>
    );
};

export default function DevicesSection() {
    const [devices, setDevices] = useState([]); //
    const [isLoading, setIsLoading] = useState(true); //
    const [showRenameModal, setShowRenameModal] = useState(false); //
    const [showDeleteModal, setShowDeleteModal] = useState(false); //
    const [selectedDevice, setSelectedDevice] = useState(null); //
    const [renameValue, setRenameValue] = useState(''); //
    const [errorMessage, setErrorMessage] = useState(''); //
    const [successMessage, setSuccessMessage] = useState(''); //

    const { deviceId: currentDeviceId } = useAuth(); //

    // Fetch devices when the component mounts
    const fetchDevices = async () => { //
        setIsLoading(true); //
        setErrorMessage(''); //
        setSuccessMessage(''); // Clear messages on fetch

        try { //
            // Use the api service to get devices
            const data = await api.get('/api/devices'); //
            setDevices(data); //
        } catch (error) { //
            console.error('Error fetching devices:', error); //
            setErrorMessage('Failed to load devices. Please try again.'); //
        } finally { //
            setIsLoading(false); //
        } //
    }; //

    useEffect(() => { //
        fetchDevices(); //
    }, []); // Run only once on mount

    // --- Modal Control ---
    const openRenameModal = (device) => { //
        setSelectedDevice(device); //
        setRenameValue(device.device_name || ''); // Pre-fill
        setShowRenameModal(true); //
        setErrorMessage(''); // Clear errors when opening modal
        setSuccessMessage('');
    }; //

    const openDeleteModal = (device) => { //
        setSelectedDevice(device); //
        setShowDeleteModal(true); //
        setErrorMessage(''); // Clear errors when opening modal
        setSuccessMessage('');
    }; //

    const closeModals = () => { //
        setShowRenameModal(false); //
        setShowDeleteModal(false); //
        setSelectedDevice(null); //
        setRenameValue(''); //
        // Don't clear messages here, they might be showing results of an action
    }; //

    // --- Action Handlers ---
    const handleRenameChange = (e) => { //
        setRenameValue(e.target.value); //
    }; //

    const handleRenameSubmit = async (e) => { //
        e.preventDefault(); //
        setErrorMessage(''); // Clear previous errors
        setSuccessMessage('');

        if (!renameValue.trim()) { //
            setErrorMessage('Device name cannot be empty'); // Show error in modal or section
            return;
        }
        if (!selectedDevice) return; //

        try { //
            await api.post(`/api/devices/${selectedDevice.id}/rename`, { //
                device_name: renameValue //
            }); //

            // Update local state
            setDevices(devices.map(d => //
                d.id === selectedDevice.id ? { ...d, device_name: renameValue } : d //
            )); //

            setSuccessMessage('Device renamed successfully'); //
            closeModals(); //
            setTimeout(() => setSuccessMessage(''), 3000); // Clear after delay

        } catch (error) { //
            console.error('Error renaming device:', error); //
            // Display error message - consider if it should be in the modal or the main section
            setErrorMessage(error.message || 'Failed to rename device.'); //
            // Decide whether to closeModals() on error or keep it open
        } //
    }; //

    const handleDeleteDevice = async () => { //
        setErrorMessage(''); // Clear previous errors
        setSuccessMessage('');
        if (!selectedDevice) return; //

        try { //
            await api.delete(`/api/devices/${selectedDevice.id}`); //

            // Update local state
            setDevices(devices.filter(device => device.id !== selectedDevice.id)); //
            setSuccessMessage('Device removed successfully'); //
            closeModals(); //
            setTimeout(() => setSuccessMessage(''), 3000); // Clear after delay

        } catch (error) { //
            console.error('Error removing device:', error); //
            // Display error message
            setErrorMessage(error.message || 'Failed to remove device.'); //
            // Decide whether to closeModals() on error
        } //
    }; //

    // --- Helper Function ---
    const getDeviceTypeIcon = (device) => { //
        const deviceType = device.device_type?.toLowerCase() || ''; //

        if (deviceType.includes('mobile') || deviceType.includes('phone')) { //
            return 'mobile'; //
        } else if (deviceType.includes('tablet')) { //
            return 'tablet'; //
        } else { //
            return 'desktop'; // Default
        } //
    }; //

    // --- Render Logic ---
    return (
        // This component now renders directly into the Profile page's content area
        <div className="devices-section-content">
            <h3>Your Devices</h3>
            <p className="section-description">
                These are the devices you've used to access CRAPP.
                We track devices to help analyze if cognitive performance varies by device.
            </p>

            {/* Display messages */}
            <DeviceMessage message={errorMessage} type="error" />
            <DeviceMessage message={successMessage} type="success" />

            {isLoading ? (
                <LoadingSpinner message="Loading your devices..." />
            ) : devices.length === 0 ? (
                 <div className="empty-state">
                    <div className="empty-icon">📱</div>
                    <h4>No devices found</h4>
                    <p>You haven't used any other devices to access CRAPP yet.</p>
                </div>
            ) : (
                <div className="devices-list" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}> {/* Add gap for spacing */}
                    {devices.map(device => (
                        <div
                            key={device.id}
                            className={`device-card ${device.id === currentDeviceId ? 'current' : ''}`} //
                        >
                            <div className="device-icon"> 
                                <span className={`device-type-icon ${getDeviceTypeIcon(device)}`}></span> 
                            </div>
                            <div className="device-info"> 
                                <div className="device-name"> 
                                    <span className="device-name-text">
                                        {device.device_name || 'Unnamed Device'} 
                                    </span>
                                    {device.id === currentDeviceId && ( //
                                        <span className="current-device-badge">Current</span> //
                                    )}
                                </div>
                                <div className="device-details"> 
                                    <span className="device-os">{device.os || 'Unknown OS'}</span> • 
                                    <span className="device-browser">{device.browser || 'Unknown Browser'}</span> 
                                </div>
                                <div className="device-last-active"> 
                                    Last active: {formatDate(device.last_active)} {/* Use formatDate util */}
                                </div>
                            </div>
                            <div className="device-actions"> 
                                <button
                                    className="rename-device-btn action-button" // Use action-button style for consistency
                                    onClick={() => openRenameModal(device)} //
                                    style={{ marginRight: '5px' }}
                                >
                                    Rename
                                </button>
                                {device.id !== currentDeviceId && ( //
                                    <button
                                        className="remove-device-btn danger-button" // Use danger style
                                        onClick={() => openDeleteModal(device)} //
                                        style={{ width: 'auto', padding: '6px 10px', fontSize: '0.8rem' }} // Match action button size
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Rename Device Modal */}
            <Modal
                isOpen={showRenameModal} //
                onClose={closeModals} //
                title="Rename Device" //
            >
                <form id="rename-device-form" onSubmit={handleRenameSubmit}> 
                    <div className="form-group"> 
                        <label htmlFor="new-device-name">New Device Name</label> 
                        <input
                            type="text" //
                            id="new-device-name" //
                            name="new_device_name" //
                            value={renameValue} //
                            onChange={handleRenameChange} //
                            required //
                            autoFocus //
                        /> 
                         {/* Display error message inside modal */}
                         <DeviceMessage message={errorMessage} type="error"/>
                    </div> 
                     <div className="modal-footer"> 
                         <button type="button" className="cancel-button" onClick={closeModals}>Cancel</button> 
                         <button type="submit" className="submit-button">Save</button> 
                    </div> 
                </form>
            </Modal>

            {/* Delete Device Modal */}
            <Modal
                isOpen={showDeleteModal}
                onClose={closeModals}
                title="Remove Device"
            >
                 <p>Are you sure you want to remove this device?</p>
                 <p>This will not delete any assessment data collected from this device.</p> 
                 {selectedDevice && <p>Device: <strong>{selectedDevice.device_name || 'Unnamed Device'}</strong></p>} 
                 {/* Display error message inside modal */}
                 <DeviceMessage message={errorMessage} type="error"/>
                 <div className="modal-footer"> 
                     <button type="button" className="cancel-button" onClick={closeModals}>Cancel</button> 
                    <button type="button" className="delete-button" onClick={handleDeleteDevice}>Remove Device</button> 
                 </div> 
            </Modal> 
        </div>
    );
}