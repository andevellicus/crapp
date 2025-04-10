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
		deviceID = req.DeviceID
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
