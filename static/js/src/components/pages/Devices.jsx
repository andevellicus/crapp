import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { formatDate } from '../../utils/utils';

export default function Devices() {
    const [devices, setDevices] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [modalState, setModalState] = React.useState({
      showRename: false,
      showDelete: false,
      deviceId: null,
      deviceName: ''
    });
    const [errorMessage, setErrorMessage] = React.useState('');
    const [successMessage, setSuccessMessage] = React.useState('');
    
    const { deviceId: currentDeviceId } = useAuth();
    
    // Load devices on component mount
    React.useEffect(() => {
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
      setModalState({
        showRename: true,
        showDelete: false,
        deviceId: device.id,
        deviceName: device.device_name || ''
      });
    };
    
    const openDeleteModal = (deviceId) => {
      setModalState({
        showRename: false,
        showDelete: true,
        deviceId: deviceId,
        deviceName: ''
      });
    };
    
    const closeModals = () => {
      setModalState({
        showRename: false,
        showDelete: false,
        deviceId: null,
        deviceName: ''
      });
    };
    
    const handleRenameChange = (e) => {
      setModalState({
        ...modalState,
        deviceName: e.target.value
      });
    };
    
    const handleRenameSubmit = async (e) => {
      e.preventDefault();
      
      if (!modalState.deviceName.trim()) {
        setErrorMessage('Device name cannot be empty');
        return;
      }
      
      try {
        const response = await api.post(`/api/devices/${modalState.deviceId}/rename`, {
          device_name: modalState.deviceName
        })

        if (!response) {
          throw new Error('Failed to rename device');
        }
        
        // Update device in state
        setDevices(devices.map(device => 
          device.id === modalState.deviceId 
            ? { ...device, device_name: modalState.deviceName }
            : device
        ));
        
        setSuccessMessage('Device renamed successfully');
        closeModals();
        
        // Clear success message after a delay
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
        
      } catch (error) {
        console.error('Error renaming device:', error);
        setErrorMessage('Failed to rename device. Please try again.');
        
        // Clear error message after a delay
        setTimeout(() => {
          setErrorMessage('');
        }, 3000);
      }
    };
    
    const handleDeleteDevice = async () => {
      try {
        const response = await api.delete(`/api/devices/${modalState.deviceId}`, {
          device_name: modalState.deviceName
        })

        if (!response) {
          throw new Error('Failed to rename device');
        }
        
        // Remove device from state
        setDevices(devices.filter(device => device.id !== modalState.deviceId));
        
        setSuccessMessage('Device removed successfully');
        closeModals();
        
        // Clear success message after a delay
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
        
      } catch (error) {
        console.error('Error removing device:', error);
        setErrorMessage('Failed to remove device. Please try again.');
        
        // Clear error message after a delay
        setTimeout(() => {
          setErrorMessage('');
        }, 3000);
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
                        onClick={() => openDeleteModal(device.id)}
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
          {modalState.showRename && (
            <div className="modal show">
              <div className="modal-content">
                <div className="modal-header">
                  <h4>Rename Device</h4>
                  <button className="close-modal" onClick={closeModals}>&times;</button>
                </div>
                <div className="modal-body">
                  <form onSubmit={handleRenameSubmit}>
                    <div className="form-group">
                      <label htmlFor="new-device-name">New Device Name</label>
                      <input 
                        type="text" 
                        id="new-device-name" 
                        name="new_device_name" 
                        value={modalState.deviceName}
                        onChange={handleRenameChange}
                        required
                      />
                    </div>
                    <div className="form-actions">
                      <button type="button" className="cancel-button" onClick={closeModals}>
                        Cancel
                      </button>
                      <button type="submit" className="submit-button">
                        Save
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
          
          {/* Confirm Delete Modal */}
          {modalState.showDelete && (
            <div className="modal show">
              <div className="modal-content">
                <div className="modal-header">
                  <h4>Remove Device</h4>
                  <button className="close-modal" onClick={closeModals}>&times;</button>
                </div>
                <div className="modal-body">
                  <p>Are you sure you want to remove this device?</p>
                  <p>This will not delete any assessment data collected from this device.</p>
                  <div className="form-actions">
                    <button type="button" className="cancel-button" onClick={closeModals}>
                      Cancel
                    </button>
                    <button type="button" className="delete-button" onClick={handleDeleteDevice}>
                      Remove Device
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }