import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/utils';
import Modal from '../common/Modal';

export default function Devices() {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
    
  const { deviceId: currentDeviceId } = useAuth();
  
  // Load devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);
  
  const fetchDevices = async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      const data = await api.get('/api/devices')

      setDevices(data);
    } catch (error) {
      console.error('Error fetching devices:', error);
      setErrorMessage('Failed to load devices. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };
    
  const openRenameModal = (device) => {
    setSelectedDevice(device);
    setRenameValue(device.device_name || ''); // Pre-fill input
    setShowRenameModal(true);
    setShowDeleteModal(false); // Ensure delete modal is closed
  };
  
  const openDeleteModal = (device) => {
    setSelectedDevice(device);
    setShowDeleteModal(true);
    setShowRenameModal(false); // Ensure rename modal is closed
  };
  
  const closeModals = () => {
    setShowRenameModal(false);
    setShowDeleteModal(false);
    setSelectedDevice(null);
    setRenameValue('');
  };
    
  const handleRenameChange = (e) => {
    setRenameValue(e.target.value);
  };
    
  const handleRenameSubmit = async (e) => {
    e.preventDefault();
    if (!renameValue.trim()) {
      setErrorMessage('Device name cannot be empty');
      return;
    }
    if (!selectedDevice) return; // Should not happen

    try {
      await api.post(`/api/devices/${selectedDevice.id}/rename`, {
        device_name: renameValue
      });

      setDevices(devices.map(d =>
        d.id === selectedDevice.id ? { ...d, device_name: renameValue } : d
      ));

      setSuccessMessage('Device renamed successfully');
      closeModals();
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('Error renaming device:', error);
      setErrorMessage('Failed to rename device. Please try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };
    
  const handleDeleteDevice = async () => {
    if (!selectedDevice) return; // Should not happen
    try {
      await api.delete(`/api/devices/${selectedDevice.id}`); // No body needed usually for DELETE

      setDevices(devices.filter(device => device.id !== selectedDevice.id));
      setSuccessMessage('Device removed successfully');
      closeModals();
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('Error removing device:', error);
      setErrorMessage('Failed to remove device. Please try again.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
};
        
// Get device type icon class
const getDeviceTypeIcon = (device) => {
  const deviceType = device.device_type?.toLowerCase() || '';
  
  if (deviceType.includes('mobile') || deviceType.includes('phone')) {
    return 'mobile';
  } else if (deviceType.includes('tablet')) {
    return 'tablet';
  } else {
    return 'desktop';
  }
};
    
return (
  <div className="profile-container">
    <div className="profile-sidebar">
      <div className="profile-nav">
        <a href="/profile" className="profile-nav-item">Account Settings</a>
        <a href="/devices" className="profile-nav-item active">Devices</a>
      </div>
    </div>
    
    <div className="profile-content">
      <h3>Your Devices</h3>
      <p className="section-description">
        These are the devices you've used to access CRAPP. 
        We track devices to help analyze if cognitive performance varies by device.
      </p>
      
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
      
      {isLoading ? (
        <div className="devices-loading">
          <div className="spinner"></div>
          <p>Loading your devices...</p>
        </div>
      ) : devices.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📱</div>
          <h4>No devices found</h4>
          <p>You haven't used any other devices to access CRAPP yet.</p>
        </div>
      ) : (
        <div className="devices-list">
          {devices.map(device => (
            <div 
              key={device.id} 
              className={`device-card ${device.id === currentDeviceId ? 'current' : ''}`}
            >
              <div className="device-icon">
                <span className={`device-type-icon ${getDeviceTypeIcon(device)}`}></span>
              </div>
              <div className="device-info">
                <div className="device-name">
                  <span className="device-name-text">
                    {device.device_name || 'Unnamed Device'}
                  </span>
                  {device.id === currentDeviceId && (
                    <span className="current-device-badge">Current</span>
                  )}
                </div>
                <div className="device-details">
                  <span className="device-os">{device.os || 'Unknown OS'}</span> • 
                  <span className="device-browser">{device.browser || 'Unknown Browser'}</span>
                </div>
                <div className="device-last-active">
                  Last active: {formatDate(device.last_active)}
                </div>
              </div>
              <div className="device-actions">
                <button 
                  className="rename-device-btn" 
                  onClick={() => openRenameModal(device)}
                >
                  Rename
                </button>
                {device.id !== currentDeviceId && (
                  <button 
                    className="remove-device-btn" 
                    onClick={() => openDeleteModal(device)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Rename Device Modal using the reusable component */}
      <Modal
        isOpen={showRenameModal}
        onClose={closeModals}
        title="Rename Device"
        footer={
          <div className="form-actions" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="cancel-button" onClick={closeModals}>
              Cancel
            </button>
            {/* Link button to form submission */}
            <button type="submit" form="rename-device-form" className="submit-button">
              Save
            </button>
          </div>
        }
      >
        {/* Use a form inside the modal body */}
        <form id="rename-device-form" onSubmit={handleRenameSubmit}>
          <div className="form-group">
            <label htmlFor="new-device-name">New Device Name</label>
            <input
              type="text"
              id="new-device-name"
              name="new_device_name"
              value={renameValue}
              onChange={handleRenameChange}
              required
              autoFocus // Focus the input when modal opens
            />
            {/* You could add error display here if needed */}
          </div>
        </form>
      </Modal>
      
      {/* Delete Device Modal using the reusable component */}
      <Modal
        isOpen={showDeleteModal}
        onClose={closeModals}
        title="Remove Device"
        footer={
          <div className="form-actions" style={{ justifyContent: 'flex-end', width: '100%' }}>
            <button type="button" className="cancel-button" onClick={closeModals}>
              Cancel
            </button>
            <button type="button" className="delete-button" onClick={handleDeleteDevice}>
              Remove Device
            </button>
          </div>
        }
      >
        <p>Are you sure you want to remove this device?</p>
        <p>This will not delete any assessment data collected from this device.</p>
        {/* Display device name for confirmation */}
        {selectedDevice && <p>Device: <strong>{selectedDevice.device_name || 'Unnamed Device'}</strong></p>}
      </Modal>
    </div>
  </div>
  );
}