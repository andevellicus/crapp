package repository

import (
	"fmt"
	"math/rand"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type DeviceRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(db *gorm.DB, log *zap.SugaredLogger) DeviceDB {
	return &DeviceRepository{
		db:  db,
		log: log.Named("device-repo"),
	}
}

func (r *DeviceRepository) Create(device *models.Device) error {
	// If new device, set created_at
	device.CreatedAt = time.Now()
	if err := r.db.Create(device); err != nil {
		return err.Error
	}
	return nil
}

func (r *DeviceRepository) GetByID(id string) (*models.Device, error) {
	if id == "" {
		return nil, fmt.Errorf("device ID cannot be empty")
	}

	var device models.Device
	result := r.db.Where("id = ?", id).First(&device)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil // return nil, nil when not found
		}
		r.log.Errorw("Database error getting device by id", "id", id, "error", result.Error)
		return nil, result.Error
	}
	return &device, nil

}

func (r *DeviceRepository) Update(device *models.Device) error {
	// Validate entity
	if device.ID == "" {
		return fmt.Errorf("device ID cannot be empty")
	}

	// Set update time
	device.LastActive = time.Now()

	// Perform update
	result := r.db.Save(device)
	if result.Error != nil {
		r.log.Errorw("Database error updating device", "error", result.Error, "id", device.ID)
		return fmt.Errorf("failed to update device: %w", result.Error)
	}

	// Check if device was found
	if result.RowsAffected == 0 {
		return fmt.Errorf("device not found: %s", device.ID)
	}

	return nil
}

func (r *DeviceRepository) Delete(id string) error {
	if id == "" {
		return fmt.Errorf("device ID cannot be empty")
	}

	// Perform deletion
	result := r.db.Delete(&models.Device{}, "id = ?", id)
	if result.Error != nil {
		r.log.Errorw("Database error deleting device", "error", result.Error, "id", id)
		return fmt.Errorf("failed to delete device: %w", result.Error)
	}

	// Log the operation
	r.log.Infow("Device deleted", "id", id, "rows_affected", result.RowsAffected)

	return nil
}

// GetUserDevices retrieves all devices for a user
func (r *DeviceRepository) GetUserDevices(userEmail string) ([]models.Device, error) {
	var devices []models.Device
	result := r.db.Where("user_email = ?", userEmail).Find(&devices)
	if result.Error != nil {
		r.log.Errorw("Database error retrieving user devices", "error", result.Error)
		return nil, result.Error
	}
	return devices, nil
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
	device := &models.Device{
		ID:         deviceID,
		UserEmail:  userEmail,
		DeviceName: deviceName,
		DeviceType: deviceType,
		Browser:    browser,
		OS:         os,
		LastActive: time.Now(),
	}

	// Check if device exists
	existingDevice, err := r.GetByID(deviceID)
	if err != nil {
		r.log.Errorw("Database error checking for existing device", "error", err)
		return nil, err
	}

	// If device exists, update it
	if existingDevice != nil {
		// Keep created_at from existing device
		device.CreatedAt = existingDevice.CreatedAt
		if err := r.Update(device); err != nil {
			return nil, err
		}
		return device, nil
	}

	if err := r.Create(device); err != nil {
		return nil, err
	}

	return device, nil
}

// UpdateDeviceName updates a device's name
func (r *DeviceRepository) UpdateDeviceName(deviceID string, userEmail string, newName string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		r.log.Errorw("Database error finding device for rename", "error", err)
		return err
	}

	// Update the device name
	device.DeviceName = newName
	return r.Update(&device)
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
