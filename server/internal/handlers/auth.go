// internal/handlers/auth.go
package handlers

import (
	"net/http"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/services"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"golang.org/x/crypto/bcrypt"
)

// AuthHandler handles authentication-related endpoints
type AuthHandler struct {
	repo        *repository.Repository
	log         *zap.SugaredLogger
	authService *services.AuthService
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
func NewAuthHandler(repo *repository.Repository, log *zap.SugaredLogger, authService *services.AuthService) *AuthHandler {
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
	newUser := &models.User{
		Email:     req.Email,
		Password:  hashedPassword,
		FirstName: req.FirstName,
		LastName:  req.LastName,
		IsAdmin:   false, // Default to non-admin
		CreatedAt: time.Now(),
		LastLogin: time.Now(),
	}

	// Save user to database
	if err := h.repo.Users.Create(newUser); err != nil {
		h.log.Errorw("Error creating user", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error creating user"})
		return
	}

	if emailService, exists := c.Get("emailService"); exists && emailService != nil {
		go emailService.(*services.EmailService).SendWelcomeEmail(newUser.Email, newUser.FirstName)
	}

	// Return response with tokens
	c.JSON(http.StatusCreated, gin.H{
		"message": "Account created successfully. Please log in.",
		"user": gin.H{
			"email":      newUser.Email,
			"first_name": newUser.FirstName,
			"last_name":  newUser.LastName,
		},
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	req := c.MustGet("validatedRequest").(*validation.LoginRequest)

	user, device, tokenPair, err := h.authService.Authenticate(req.Email, req.Password, req.DeviceInfo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid email or password"})
		h.log.Errorw("Error during authentication", "email", req.Email)
		return
	}
	if user == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User does not exist"})
		return
	}

	// Get cookie settings
	cookieConfig := h.authService.GetCookieConfig()

	// Set auth token cookie
	c.SetCookie(
		"auth_token",
		tokenPair.AccessToken,
		tokenPair.ExpiresIn,
		cookieConfig.Path,
		cookieConfig.Domain,
		cookieConfig.Secure,
		cookieConfig.HttpOnly,
	)

	// Set refresh token cookie - longer expiration
	// Convert refresh token TTL from days to seconds
	refreshExpiresIn := h.authService.JWTConfig.RefreshExpires * 24 * 60 * 60
	c.SetCookie(
		"refresh_token",
		tokenPair.RefreshToken,
		refreshExpiresIn,
		cookieConfig.Path,
		cookieConfig.Domain,
		cookieConfig.Secure,
		cookieConfig.HttpOnly,
	)

	// Also set the device ID in a cookie (not httpOnly)
	c.SetCookie(
		"device_id",
		device.ID,
		refreshExpiresIn, // Same lifespan as refresh token
		cookieConfig.Path,
		cookieConfig.Domain,
		cookieConfig.Secure,
		false, // Not HttpOnly so JS can access
	)

	// Return response without tokens
	c.JSON(http.StatusOK, gin.H{
		"message":    "Login successful",
		"user":       *user,
		"device_id":  device.ID,
		"expires_in": tokenPair.ExpiresIn,
	})
}

// Logout handles user logout and token revocation
func (h *AuthHandler) Logout(c *gin.Context) {
	// Get token ID from context
	tokenID, hasTokenID := c.Get("tokenID")

	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		h.log.Warnw("No authenticated session for logout")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "No authenticated session"})
		return
	}

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

	// Clear auth cookies
	cookieConfig := h.authService.GetCookieConfig()
	c.SetCookie("auth_token", "", -1, cookieConfig.Path, cookieConfig.Domain, cookieConfig.Secure, cookieConfig.HttpOnly)
	c.SetCookie("refresh_token", "", -1, cookieConfig.Path, cookieConfig.Domain, cookieConfig.Secure, cookieConfig.HttpOnly)
	//c.SetCookie("device_id", "", -1, cookieConfig.Path, cookieConfig.Domain, cookieConfig.Secure, false)

	h.log.Infow("Logout successful", "userEmail", userEmail)
	c.JSON(http.StatusOK, gin.H{"message": "Successfully logged out"})
}

// RefreshToken handles token refresh requests
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	// Get refresh token from cookie instead of request body
	refreshToken, err := c.Cookie("refresh_token")
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Missing refresh token"})
		return
	}

	// Get device ID
	deviceID := getDeviceID(c)
	if deviceID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Device ID required"})
		return
	}

	// Use the auth service to refresh the token
	tokenPair, err := h.authService.RefreshToken(refreshToken, deviceID)
	if err != nil {
		h.log.Warnw("Token refresh failed", "error", err)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired refresh token"})
		return
	}

	// Get cookie settings
	cookieConfig := h.authService.GetCookieConfig()

	// Set new cookies
	c.SetCookie(
		"auth_token",
		tokenPair.AccessToken,
		tokenPair.ExpiresIn,
		cookieConfig.Path,
		cookieConfig.Domain,
		cookieConfig.Secure,
		cookieConfig.HttpOnly,
	)

	// Set refresh token cookie - longer expiration
	refreshExpiresIn := h.authService.JWTConfig.RefreshExpires * 24 * 60 * 60
	c.SetCookie(
		"refresh_token",
		tokenPair.RefreshToken,
		refreshExpiresIn,
		cookieConfig.Path,
		cookieConfig.Domain,
		cookieConfig.Secure,
		cookieConfig.HttpOnly,
	)

	// Return success
	c.JSON(http.StatusOK, gin.H{
		"message":    "Token refreshed successfully",
		"expires_in": tokenPair.ExpiresIn,
	})
}
