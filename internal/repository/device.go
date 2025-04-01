package repository

import (
	"math/rand"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// DeviceRepository extends the generic repository with user-specific methods
type DeviceRepository struct {
	Base *BaseRepository[models.Device]
}

// NewUserRepository creates a new device repository
func NewDeviceRepository(db *gorm.DB, log *zap.SugaredLogger) *DeviceRepository {
	return &DeviceRepository{
		Base: NewBaseRepository[models.Device](db, log.Named("device"), "devices"),
	}
}

// GetUserDevices retrieves all devices for a user
func (r *DeviceRepository) GetUserDevices(userEmail string) ([]models.Device, error) {
	var devices []models.Device
	result := r.Base.DB.Where("user_email = ?", userEmail).Find(&devices)
	if result.Error != nil {
		r.Base.Log.Errorw("Failed to retrieve user devices", "error", result.Error)
		return nil, result.Error
	}
	return devices, nil
}

// UpdateDeviceName updates a device's name
func (r *DeviceRepository) UpdateDeviceName(deviceID string, userEmail string, newName string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.Base.DB.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		r.Base.Log.Errorw("Failed to find device for rename", "error", err)
		return err
	}

	// Update the device name
	device.DeviceName = newName
	return r.Base.Update(&device)
}

// RegisterDevice registers a new device or updates an existing one
func (r *DeviceRepository) RegisterDevice(userEmail string, deviceInfo map[string]any) (*models.Device, error) {
	// Generate device ID if not provided
	deviceID := r.generateDeviceID(deviceInfo)

	// Extract device information
	deviceName, _ := deviceInfo["device_name"].(string)
	deviceType, _ := deviceInfo["device_type"].(string)
	browser, _ := deviceInfo["user_agent"].(string)
	os, _ := deviceInfo["os"].(string)

	// Create or update device
	device := models.Device{
		ID:         deviceID,
		UserEmail:  userEmail,
		DeviceName: deviceName,
		DeviceType: deviceType,
		Browser:    browser,
		OS:         os,
		LastActive: time.Now(),
	}

	// Check if device exists
	existingDevice, err := r.Base.GetByID(deviceID)
	if err != nil {
		r.Base.Log.Errorw("Error checking for existing device", "error", err)
		return nil, err
	}

	// If device exists, update it
	if existingDevice != nil {
		// Keep created_at from existing device
		device.CreatedAt = existingDevice.CreatedAt
		if err := r.Base.Update(&device); err != nil {
			return nil, err
		}
		return &device, nil
	}

	// If new device, set created_at
	device.CreatedAt = time.Now()
	if err := r.Base.Create(&device); err != nil {
		return nil, err
	}

	return &device, nil
}

// generateDeviceID creates a unique device ID
func (r *DeviceRepository) generateDeviceID(deviceInfo map[string]any) string {
	// Check if an ID is already provided
	if id, ok := deviceInfo["id"].(string); ok && id != "" {
		return id
	}

	// Generate a random ID
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 16)
	for i := range b {
		b[i] = charset[rand.Int63()%int64(len(charset))]
	}
	return string(b)
}
