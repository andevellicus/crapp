package handlers

import (
	"net/http"
	"time"

	"github.com/andevellicus/crapp/internal/auth"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication-related endpoints
type AuthHandler struct {
	repo        *repository.Repository
	log         *zap.SugaredLogger
	authService *auth.AuthService
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=8"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// RegisterDeviceRequest represents a device registration request
type RegisterDeviceRequest struct {
	DeviceName string                 `json:"device_name"`
	DeviceType string                 `json:"device_type"`
	UserAgent  string                 `json:"user_agent"`
	OS         string                 `json:"os"`
	ScreenSize map[string]interface{} `json:"screen_size"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Email      string                 `json:"email" binding:"required,email"`
	Password   string                 `json:"password" binding:"required"`
	DeviceInfo map[string]interface{} `json:"device_info"`
}

// AuthResponse represents the response for login/register
type AuthResponse struct {
	Token    string      `json:"token"`
	User     models.User `json:"user"`
	DeviceID string      `json:"device_id"`
}

// NewAuthHandler creates a new authentication handler
func NewAuthHandler(repo *repository.Repository, log *zap.SugaredLogger, authService *auth.AuthService) *AuthHandler {
	return &AuthHandler{
		repo:        repo,
		log:         log.Named("auth"),
		authService: authService,
	}
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warnw("Invalid registration data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid registration data"})
		return
	}

	// Check if user already exists
	exists, err := h.repo.UserExists(req.Email)
	if err != nil {
		h.log.Errorw("Error checking user existence", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	if exists {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.log.Errorw("Error hashing password", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Internal server error"})
		return
	}

	// Create user
	user := models.User{
		Email:     req.Email,
		Password:  hashedPassword,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		IsAdmin:   false, // Default to non-admin
		CreatedAt: time.Now(),
		LastLogin: time.Now(),
	}

	// Save user to database
	if err := h.repo.CreateUser(&user); err != nil {
		h.log.Errorw("Error creating user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
		return
	}

	// Register device and generate JWT
	device, token := h.registerDeviceAndGenerateToken(c, h.authService, user.Email, user.IsAdmin)

	// Return response
	c.JSON(http.StatusCreated, AuthResponse{
		Token:    token,
		User:     user,
		DeviceID: device.ID,
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid login data"})
		return
	}

	user, device, token, err := h.authService.Authenticate(req.Email, req.Password, req.DeviceInfo)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	// Set cookie for server-side auth
	c.SetCookie("auth_token", token, 86400, "/", "", false, true)

	// Return response for client-side handling
	c.JSON(http.StatusOK, AuthResponse{
		Token:    token,
		User:     *user,
		DeviceID: device.ID,
	})
}

// Helper to register device and generate token
func (h *AuthHandler) registerDeviceAndGenerateToken(c *gin.Context, authService *auth.AuthService, email string, isAdmin bool) (*models.Device, string) {
	// Extract device info
	deviceInfo := extractDeviceInfo(c)

	// Register device
	device, err := h.repo.RegisterDevice(email, deviceInfo)
	if err != nil {
		h.log.Errorw("Error registering device", "error", err)
		// Create a default device if registration fails
		device = &models.Device{
			ID:        "unknown",
			UserEmail: email,
		}
	}

	// Generate JWT token
	token, err := authService.GenerateToken(email, isAdmin)
	if err != nil {
		h.log.Errorw("Error generating JWT", "error", err)
		token = ""
	}

	return device, token
}

// extractDeviceInfo extracts device information from the request
func extractDeviceInfo(c *gin.Context) map[string]interface{} {
	userAgent := c.GetHeader("User-Agent")

	deviceInfo := map[string]interface{}{
		"user_agent": userAgent,
		"ip":         c.ClientIP(),
	}

	return deviceInfo
}

// RegisterDevice handles registration of a new device
func (h *AuthHandler) RegisterDevice(c *gin.Context) {
	var req RegisterDeviceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warnw("Invalid device registration data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid device data"})
		return
	}

	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Convert request to device info map
	deviceInfo := map[string]interface{}{
		"device_name": req.DeviceName,
		"device_type": req.DeviceType,
		"user_agent":  req.UserAgent,
		"os":          req.OS,
		"screen_size": req.ScreenSize,
	}

	// Register device
	device, err := h.repo.RegisterDevice(userEmail.(string), deviceInfo)
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

// GetUserDevices returns all devices for the authenticated user
func (h *AuthHandler) GetUserDevices(c *gin.Context) {
	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get devices from repository
	devices, err := h.repo.GetUserDevices(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user devices", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving devices"})
		return
	}

	c.JSON(http.StatusOK, devices)
}

// GetCurrentUser returns the current user's information
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user from database
	user, err := h.repo.GetUser(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user information"})
		return
	}

	// Don't return password hash
	user.Password = nil

	c.JSON(http.StatusOK, user)
}

// UserUpdateRequest represents a user profile update request
type UserUpdateRequest struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	CurrentPassword string `json:"current_password,omitempty"`
	NewPassword     string `json:"new_password,omitempty"`
}

// UpdateUser updates the current user's information
func (h *AuthHandler) UpdateUser(c *gin.Context) {
	var req UserUpdateRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warnw("Invalid user update data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid update data"})
		return
	}

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get current user
	user, err := h.repo.GetUser(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user for update", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	// Update basic info
	user.FirstName = req.FirstName
	user.LastName = req.LastName

	// If changing password, verify current password
	if req.NewPassword != "" {
		if req.CurrentPassword == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is required"})
			return
		}

		// Verify current password
		err = bcrypt.CompareHashAndPassword(user.Password, []byte(req.CurrentPassword))
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
			return
		}

		// Hash and set new password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			h.log.Errorw("Error hashing new password", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating password"})
			return
		}

		user.Password = hashedPassword
	}

	// Save updated user
	if err := h.repo.UpdateUser(user); err != nil {
		h.log.Errorw("Error updating user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
		return
	}

	// Don't return password hash in response
	user.Password = nil

	c.JSON(http.StatusOK, user)
}

// DeleteDeviceRequest represents a device deletion request
type DeleteDeviceRequest struct {
	DeviceID string `json:"device_id" binding:"required"`
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
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Delete device
	err := h.repo.DeleteDevice(deviceID, userEmail.(string))
	if err != nil {
		h.log.Errorw("Error removing device", "error", err, "deviceId", deviceID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error removing device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device removed successfully"})
}

// RenameDeviceRequest represents a device rename request
type RenameDeviceRequest struct {
	DeviceName string `json:"device_name" binding:"required"`
}

// RenameDevice renames a device
func (h *AuthHandler) RenameDevice(c *gin.Context) {
	var req RenameDeviceRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warnw("Invalid device rename data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid rename data"})
		return
	}

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
	err := h.repo.UpdateDeviceName(deviceID, userEmail.(string), req.DeviceName)
	if err != nil {
		h.log.Errorw("Error renaming device", "error", err, "deviceId", deviceID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error renaming device"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Device renamed successfully"})
}
