package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
)

// GetUserDevices returns all devices for the authenticated user
func (h *AuthHandler) GetUserDevices(c *gin.Context) {
	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get devices from repository
	devices, err := h.repo.Devices.GetUserDevices(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user devices", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving devices"})
		return
	}

	c.JSON(http.StatusOK, devices)
}

// RegisterDevice handles registration of a new device
func (h *AuthHandler) RegisterDevice(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.RegisterDeviceRequest)

	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Convert request to device info map
	deviceInfo := map[string]any{
		"device_name": req.DeviceName,
		"device_type": req.DeviceType,
		"user_agent":  req.UserAgent,
		"screen_size": req.ScreenSize,
	}

	// Register device
	device, err := h.repo.Devices.RegisterDevice(userEmail.(string), deviceInfo)
	if err != nil {
		h.log.Errorw("Error registering device", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error registering device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device_id": device.ID,
		"message":   "Device registered successfully",
	})
}

// RemoveDevice removes a device
func (h *AuthHandler) RemoveDevice(c *gin.Context) {
	// Get device ID from URL
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Device ID is required"})
		return
	}

	// Get user email from context
	_, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Delete device
	err := h.repo.Devices.Delete(deviceID)
	if err != nil {
		h.log.Errorw("Error removing device", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error removing device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device removed successfully"})
}

// RenameDevice renames a device
func (h *AuthHandler) RenameDevice(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.RenameDeviceRequest)

	// Get device ID from URL
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Device ID is required"})
		return
	}

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Update device name
	err := h.repo.Devices.UpdateDeviceName(deviceID, userEmail.(string), req.DeviceName)
	if err != nil {
		h.log.Errorw("Error renaming device", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error renaming device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device renamed successfully"})
}

func getDeviceID(c *gin.Context) string {
	// Get device ID from cookie
	deviceID, err := c.Cookie("device_id")
	if err != nil {
		// Fall back to header
		deviceID = c.GetHeader("X-Device-ID")
	}
	return deviceID
}
