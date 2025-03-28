package repository

import (
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

// RegisterDevice registers a new device or updates an existing one
func (r *Repository) RegisterDevice(userEmail string, deviceInfo map[string]interface{}) (*models.Device, error) {
	// Check if user exists
	if _, err := r.GetUser(userEmail); err != nil {
		return nil, fmt.Errorf("user not found: %w", err)
	}

	// Generate device ID if not provided
	var deviceID string

	// Try to find existing device with similar user agent
	userAgent, hasUA := deviceInfo["user_agent"].(string)

	if hasUA {
		var existingDevices []models.Device
		r.db.Where("user_email = ?", userEmail).Find(&existingDevices)

		// Look for a device with a matching user agent
		for _, device := range existingDevices {
			// No type assertion needed since Browser is already a string
			if device.Browser != "" && strings.Contains(userAgent, device.Browser) {
				// Found a matching device, update it
				deviceID = device.ID
				break
			}
		}
	}

	// If no existing device found, generate a new ID
	if deviceID == "" {
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

	// Create or update device
	device := models.Device{
		ID:         deviceID,
		UserEmail:  userEmail,
		DeviceName: deviceName,
		DeviceType: deviceType,
		Browser:    browser,
		OS:         os,
		LastActive: time.Now(),
		CreatedAt:  time.Now(),
	}

	// Save to database (upsert)
	result := r.db.Save(&device)
	if result.Error != nil {
		return nil, result.Error
	}

	return &device, nil
}

// GetUserDevices retrieves all devices for a user
func (r *Repository) GetUserDevices(userEmail string) ([]models.Device, error) {
	var devices []models.Device

	result := r.db.Where("user_email = ?", userEmail).Find(&devices)
	if result.Error != nil {
		return nil, result.Error
	}

	return devices, nil
}

// GetDevice retrieves a device by ID
func (r *Repository) GetDevice(deviceID string) (*models.Device, error) {
	var device models.Device

	result := r.db.Where("id = ?", deviceID).First(&device)
	if result.Error != nil {
		return nil, result.Error
	}

	return &device, nil
}

// DeleteDevice removes a device
func (r *Repository) DeleteDevice(deviceID string, userEmail string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		return err
	}

	// Delete the device
	return r.db.Delete(&device).Error
}

// UpdateDeviceName updates a device's name
func (r *Repository) UpdateDeviceName(deviceID string, userEmail string, newName string) error {
	// Verify the device belongs to the user
	var device models.Device
	if err := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device).Error; err != nil {
		return err
	}

	// Update the device name
	device.DeviceName = newName
	return r.db.Save(&device).Error
}
