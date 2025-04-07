// internal/handlers/auth.go
package handlers

import (
	"net/http"
	"time"

	"github.com/andevellicus/crapp/internal/auth"
	"github.com/andevellicus/crapp/internal/email"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/validation"
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
	DeviceName string         `json:"device_name"`
	DeviceType string         `json:"device_type"`
	UserAgent  string         `json:"user_agent"`
	OS         string         `json:"os"`
	ScreenSize map[string]any `json:"screen_size"`
}

// RenameDeviceRequest represents a device rename request
type RenameDeviceRequest struct {
	DeviceName string `json:"device_name" binding:"required"`
}

// DeleteDeviceRequest represents a device deletion request
type DeleteDeviceRequest struct {
	DeviceID string `json:"device_id" binding:"required"`
}

// LoginRequest represents a user login request
type LoginRequest struct {
	Email      string         `json:"email" binding:"required,email"`
	Password   string         `json:"password" binding:"required"`
	DeviceInfo map[string]any `json:"device_info"`
}

// RefreshTokenRequest represents a request to refresh an access token
type RefreshTokenRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// UserUpdateRequest represents a user profile update request
type UserUpdateRequest struct {
	FirstName       string `json:"first_name"`
	LastName        string `json:"last_name"`
	CurrentPassword string `json:"current_password,omitempty"`
	NewPassword     string `json:"new_password,omitempty"`
}

// AuthResponse represents the response for login/register
type AuthResponse struct {
	Token        string      `json:"token"`
	AccessToken  string      `json:"access_token"`
	RefreshToken string      `json:"refresh_token"`
	ExpiresIn    int         `json:"expires_in"`
	TokenType    string      `json:"token_type"`
	User         models.User `json:"user"`
	DeviceID     string      `json:"device_id"`
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
	// Get validated data from context
	req := c.MustGet("validatedRequest").(*validation.RegisterRequest)

	// Check if user already exists
	exists, err := h.repo.Users.UserExists(req.Email)
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
	if err := h.repo.Users.Create(&user); err != nil {
		h.log.Errorw("Error creating user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
		return
	}

	// Register device and generate tokens
	device, tokenPair, err := h.registerDeviceAndGenerateTokens(c, h.authService, user.Email, user.IsAdmin)
	if err != nil {
		h.log.Errorw("Error generating tokens", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error setting up account"})
		return
	}

	// Set cookie for server-side auth
	if tokenPair != nil {
		c.SetCookie("auth_token", tokenPair.AccessToken, tokenPair.ExpiresIn, "/", "", true, true)
	}

	if emailService, exists := c.Get("emailService"); exists && emailService != nil {
		go emailService.(*email.EmailService).SendWelcomeEmail(user.Email, user.FirstName)
	}

	// Return response with tokens
	c.JSON(http.StatusCreated, gin.H{
		"message": "Account created successfully",
		"user": gin.H{
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
		},
		"device_id":     device.ID,
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_in":    tokenPair.ExpiresIn,
		"token_type":    "Bearer",
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.LoginRequest)

	user, device, tokenPair, err := h.authService.Authenticate(req.Email, req.Password, req.DeviceInfo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password"})
		return
	}
	if user == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User does not exist"})
		return
	}

	// Set cookie for server-side auth (access token only)
	c.SetCookie("auth_token", tokenPair.AccessToken, tokenPair.ExpiresIn, "/", "", true, true)

	// Return response with both tokens for client-side handling
	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_in":    tokenPair.ExpiresIn,
		"token_type":    "Bearer",
		"user":          *user,
		"device_id":     device.ID,
	})
}

// Logout handles user logout and token revocation
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get user email from context - this should be set by auth middleware
	userEmail, exists := c.Get("userEmail")
	if !exists {
		h.log.Warnw("No authenticated session for logout")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No authenticated session"})
		return
	}

	// Try to get tokenID if available
	tokenID, hasTokenID := c.Get("tokenID")

	// If we have a tokenID, revoke the specific token
	if hasTokenID && tokenID != nil {
		h.log.Infow("Revoking specific token", "tokenID", tokenID)
		err := h.authService.RevokeToken(tokenID.(string))
		if err != nil {
			h.log.Warnw("Error revoking token", "error", err)
			// Continue with logout anyway
		}
	} else {
		// Otherwise revoke all tokens for this user
		h.log.Infow("No token ID available, revoking all user tokens")
		err := h.authService.RevokeAllUserTokens(userEmail.(string))
		if err != nil {
			h.log.Warnw("Error revoking all tokens", "error", err)
			// Continue with logout anyway
		}
	}

	// Clear auth cookie
	c.SetCookie("auth_token", "", -1, "/", "", true, true)

	h.log.Infow("Logout successful", "userEmail", userEmail)
	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out"})
}

// RefreshToken handles token refresh requests
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.RefreshTokenRequest)

	// Get device ID from header or query
	deviceID := c.GetHeader("X-Device-ID")
	if deviceID == "" {
		// Check if device ID is in query
		deviceID = c.Query("device_id")
		if deviceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Device ID is required"})
			return
		}
	}

	// Use the auth service to refresh the token
	tokenPair, err := h.authService.RefreshToken(req.RefreshToken, deviceID)
	if err != nil {
		h.log.Warnw("Token refresh failed", "error", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
		return
	}

	// Return the new token pair
	c.JSON(http.StatusOK, gin.H{
		"access_token":  tokenPair.AccessToken,
		"refresh_token": tokenPair.RefreshToken,
		"expires_in":    tokenPair.ExpiresIn,
		"token_type":    "Bearer",
	})
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
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user information"})
		return
	}

	// Don't return password hash
	user.Password = nil

	c.JSON(http.StatusOK, user)
}

// UpdateUser updates the current user's information
func (h *AuthHandler) UpdateUser(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.UpdateUserRequest)

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get current user
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
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
			// This needs to be a bad request
			c.JSON(http.StatusBadRequest, gin.H{"error": "Current password is incorrect"})
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

		// Save updated password
		if err := h.repo.Users.UpdatePassword(user.Email, user.Password); err != nil {
			h.log.Errorw("Error updating user password", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
			return
		}
	}

	// Save updated user name
	if err := h.repo.Users.UpdateUserName(user); err != nil {
		h.log.Errorw("Error updating user name", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
		return
	}

	// Don't return password hash in response
	user.Password = nil

	if err := h.repo.Users.LastLoginNow(user.Email); err != nil {
		h.log.Errorw("Error updating user login time", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error updating user"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// DeleteAccount handles user account deletion
func (h *AuthHandler) DeleteAccount(c *gin.Context) {
	// Get validated request
	req := c.MustGet("validatedRequest").(*validation.DeleteAccountRequest)

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user from database
	user, err := h.repo.Users.GetByEmail(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error retrieving user for deletion", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	if user == nil {
		h.log.Errorw("Error retrieving user for deletion -- user is nil!", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving user"})
		return
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword(user.Password, []byte(req.Password))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Incorrect password"})
		return
	}

	// Get current token ID to revoke all sessions
	tokenID, hasTokenID := c.Get("tokenID")
	if hasTokenID && tokenID != nil {
		h.authService.RevokeAllUserTokens(userEmail.(string))
	}

	// Delete user account
	err = h.repo.Users.Delete(userEmail.(string))
	if err != nil {
		h.log.Errorw("Error deleting user account", "error", err, "userEmail", userEmail)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}

	// Clear auth cookie
	c.SetCookie("auth_token", "", -1, "/", "", true, true)

	c.JSON(http.StatusOK, gin.H{"message": "Account deleted successfully"})
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
		"os":          req.OS,
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

// Helper to register device and generate token
func (h *AuthHandler) registerDeviceAndGenerateTokens(c *gin.Context, authService *auth.AuthService, email string, isAdmin bool) (*models.Device, *auth.TokenPair, error) {
	// Extract device info
	deviceInfo := extractDeviceInfo(c)

	// Register device
	device, err := h.repo.Devices.RegisterDevice(email, deviceInfo)
	if err != nil {
		h.log.Errorw("Error registering device", "error", err)
		return nil, nil, err
	}

	// Generate token pair
	tokenPair, err := authService.GenerateTokenPair(email, isAdmin, device.ID)
	if err != nil {
		h.log.Errorw("Error generating token pair", "error", err)
		return device, nil, err
	}

	return device, tokenPair, nil
}

// extractDeviceInfo extracts device information from the request
func extractDeviceInfo(c *gin.Context) map[string]any {
	userAgent := c.GetHeader("User-Agent")

	deviceInfo := map[string]any{
		"user_agent": userAgent,
		"ip":         c.ClientIP(),
	}

	return deviceInfo
}
