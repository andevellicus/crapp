package repository

import (
	"fmt"
	"math/rand"
	"strings"
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
func NewDeviceRepository(db *gorm.DB, log *zap.SugaredLogger) *DeviceRepository {
	return &DeviceRepository{
		db:  db,
		log: log.Named("device-repo"),
	}
}

func (r *DeviceRepository) Create(device *models.Device) error {
	// If new device, set created_at
	device.CreatedAt = time.Now()
	if err := r.db.Create(device).Error; err != nil {
		return err
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

// Delete handles device deletion with cascading updates
func (r *DeviceRepository) Delete(id string) error {
	if id == "" {
		return fmt.Errorf("device ID cannot be empty")
	}

	// Start a transaction to ensure all operations succeed or fail together
	tx := r.db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	// Update related records first
	// 1. Update assessments to use a null device ID or placeholder
	if err := tx.Model(&models.Assessment{}).
		Where("device_id = ?", id).
		Update("device_id", nil).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update assessments: %w", err)
	}

	// 2. Update CPT results
	if err := tx.Model(&models.CPTResult{}).
		Where("device_id = ?", id).
		Update("device_id", nil).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update CPT results: %w", err)
	}

	// 3. Update TMT results
	if err := tx.Model(&models.TMTResult{}).
		Where("device_id = ?", id).
		Update("device_id", nil).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update TMT results: %w", err)
	}

	// 4. Update refresh tokens
	if err := tx.Delete(&models.RefreshToken{}, "device_id = ?", id).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete refresh tokens: %w", err)
	}

	// Finally, delete the device
	if err := tx.Delete(&models.Device{}, "id = ?", id).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to delete device: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Log the operation
	r.log.Infow("Device deleted with related data updated", "id", id)

	return nil
}

// GetUserDevices retrieves all devices for a user
func (r *DeviceRepository) GetUserDevices(email string) ([]models.Device, error) {
	normalizedEmail := strings.ToLower(email)
	devices := []models.Device{}
	result := r.db.Where("LOWER(user_email) = ?", normalizedEmail).Find(&devices)
	if result.Error != nil {
		r.log.Errorw("Database error retrieving user devices", "error", result.Error)
		return nil, result.Error
	}
	return devices, nil
}

// RegisterDevice registers a new device or updates an existing one
func (r *DeviceRepository) RegisterDevice(email string, deviceInfo map[string]any) (*models.Device, error) {
	normalizedEmail := strings.ToLower(email)

	// Generate device ID if not provided
	deviceID := ""

	if deviceInfo == nil {
		deviceInfo = make(map[string]any)
	}

	// Check if an ID is already provided
	if id, ok := deviceInfo["id"].(string); ok && id != "" {
		deviceID = id
	} else {
		// Generate a random ID
		const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
		b := make([]byte, 16)
		for i := range b {
			b[i] = charset[rand.Int63()%int64(len(charset))]
		}
		deviceID = string(b)
	}

	// Extract device information
	deviceName, _ := deviceInfo["device_name"].(string)
	deviceType, _ := deviceInfo["device_type"].(string)
	browser, _ := deviceInfo["user_agent"].(string)
	os, _ := deviceInfo["os"].(string)

	if os == "" && deviceInfo["user_agent"] != nil {
		if userAgent, ok := deviceInfo["user_agent"].(string); ok && userAgent != "" {
			userAgentLower := strings.ToLower(userAgent)

			if strings.Contains(userAgentLower, "windows") {
				os = "Windows"
			} else if strings.Contains(userAgentLower, "mac") || strings.Contains(userAgentLower, "darwin") {
				os = "macOS"
			} else if strings.Contains(userAgentLower, "linux") {
				os = "Linux"
			} else if strings.Contains(userAgentLower, "android") {
				os = "Android"
			} else if strings.Contains(userAgentLower, "ios") || strings.Contains(userAgentLower, "iphone") || strings.Contains(userAgentLower, "ipad") {
				os = "iOS"
			}
		}
	}

	// Create or update device
	device := &models.Device{
		ID:         deviceID,
		UserEmail:  normalizedEmail,
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
func (r *DeviceRepository) UpdateDeviceName(deviceID string, email string, newName string) error {
	normalizedEmail := strings.ToLower(email)
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND LOWER(user_email) = ?", deviceID, normalizedEmail).First(&device).Error; err != nil {
		r.log.Errorw("Database error finding device for rename", "error", err)
		return err
	}

	// Update the device name
	device.DeviceName = newName
	return r.Update(&device)
}
