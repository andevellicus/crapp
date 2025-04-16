// internal/auth/service.go
package services

import (
	"fmt"
	"net/http"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/golang-jwt/jwt/v4"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo            *repository.Repository
	tokenTTL        time.Duration
	refreshTokenTTL time.Duration
	secretKey       string
	JWTConfig       *config.JWTConfig
}

// CustomClaims defines the claims in the JWT token
type CustomClaims struct {
	Email   string `json:"email"`
	IsAdmin bool   `json:"is_admin"`
	TokenID string `json:"token_id"`
	jwt.RegisteredClaims
}

// TokenPair contains both access and refresh tokens
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"` // Expiration in seconds
}

// Add this to the AuthService struct
type CookieConfig struct {
	Domain   string
	Path     string
	Secure   bool
	HttpOnly bool
	SameSite http.SameSite
}

func NewAuthService(repo *repository.Repository, cfg *config.JWTConfig) *AuthService {
	return &AuthService{
		repo:            repo,
		tokenTTL:        time.Duration(cfg.Expires) * time.Minute,           // Short-lived access token
		refreshTokenTTL: time.Duration(cfg.RefreshExpires) * time.Hour * 24, // Longer-lived refresh token (days)
		secretKey:       cfg.Secret,
		JWTConfig:       cfg,
	}
}

func (s *AuthService) GetCookieConfig() CookieConfig {
	return CookieConfig{
		Domain:   "",                   // Empty for current domain
		Path:     "/",                  // Available on all paths
		Secure:   true,                 // HTTPS only
		HttpOnly: true,                 // Not accessible by JavaScript
		SameSite: http.SameSiteLaxMode, // Helps with CSRF protection
	}
}

// Authenticate validates credentials and returns user with session
func (s *AuthService) Authenticate(email, password string, deviceInfo map[string]any) (*models.User, *models.Device, *TokenPair, error) {
	exists, err := s.repo.Users.UserExists(email)
	if err != nil {
		return nil, nil, nil, err
	}
	// User does not exist
	if !exists {
		return nil, nil, nil, fmt.Errorf("user not found")
	}

	// Get user
	user, err := s.repo.Users.GetByEmail(email)
	if err != nil {
		return nil, nil, nil, err
	}

	if user.Password == nil {
		// Return a generic error to avoid exposing account state
		return nil, nil, nil, fmt.Errorf("attempted login for user with nil password hash")
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword(user.Password, []byte(password))
	if err != nil {
		return nil, nil, nil, fmt.Errorf("invalid password")
	}

	// Register device
	device, err := s.repo.Devices.RegisterDevice(email, deviceInfo)
	if err != nil {
		return nil, nil, nil, err
	}

	// Generate token pair
	tokenPair, err := s.GenerateTokenPair(email, user.IsAdmin, device.ID)
	if err != nil {
		return nil, nil, nil, err
	}

	// Update last login time
	if err := s.repo.Users.LastLoginNow(email); err != nil {
		return nil, nil, nil, err
	}

	return user, device, tokenPair, nil
}

// GenerateTokenPair creates a new JWT access token and refresh token
func (s *AuthService) GenerateTokenPair(email string, isAdmin bool, deviceID string) (*TokenPair, error) {
	// Create a token ID (jti)
	tokenID := uuid.New().String()

	// Generate access token
	accessToken, err := s.generateAccessToken(email, isAdmin, tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token
	refreshToken := uuid.New().String()

	// Store refresh token in database
	refreshTokenModel := &models.RefreshToken{
		Token:     refreshToken,
		UserEmail: email,
		DeviceID:  deviceID,
		TokenID:   tokenID,
		ExpiresAt: time.Now().Add(s.refreshTokenTTL),
		CreatedAt: time.Now(),
	}

	if err = s.repo.RefreshTokens.Create(refreshTokenModel); err != nil {
		return nil, fmt.Errorf("failed to store new refresh token: %w", err)
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.tokenTTL.Seconds()),
	}, nil
}

// generateAccessToken creates a JWT access token
func (s *AuthService) generateAccessToken(email string, isAdmin bool, tokenID string) (string, error) {
	// Add more claims for security
	expirationTime := time.Now().Add(s.tokenTTL)
	notBeforeTime := time.Now().Add(s.JWTConfig.NotBefore)
	if s.JWTConfig.NotBefore > 0 {
		notBeforeTime = time.Now().Add(s.JWTConfig.NotBefore)
	}

	claims := &CustomClaims{
		Email:   email,
		IsAdmin: isAdmin,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(notBeforeTime),
			Issuer:    s.JWTConfig.Issuer,
			Audience:  []string{s.JWTConfig.Audience},
			Subject:   email,
			ID:        tokenID, // JWT ID
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.JWTConfig.Secret))
	if err != nil {
		return "", fmt.Errorf("failed to sign access token: %w", err)
	}

	return tokenString, err
}

// RefreshToken generates a new access token using a refresh token
func (s *AuthService) RefreshToken(refreshToken string, deviceID string) (*TokenPair, error) {
	// 1. Validate the existing refresh token
	storedToken, err := s.repo.RefreshTokens.GetByTokenID(refreshToken)
	if err != nil {
		// Handles not found or already revoked
		return nil, fmt.Errorf("invalid refresh token: %w", err)
	}

	// 2. Check if token is expired
	if storedToken.ExpiresAt.Before(time.Now()) {
		// Optionally delete expired token here or rely on scheduler
		// s.repo.RefreshTokens.Delete(refreshToken) // Or mark as expired
		return nil, fmt.Errorf("refresh token expired")
	}

	// 3. Check if token belongs to this device
	if storedToken.DeviceID != deviceID {
		return nil, fmt.Errorf("invalid device for refresh token")
	}

	// 4. Get user associated with the token
	user, err := s.repo.Users.GetByEmail(storedToken.UserEmail)
	if err != nil {
		// User associated with token not found
		return nil, fmt.Errorf("user not found for refresh token: %w", err)
	}

	// 5. Generate NEW token pair FIRST
	newTokenPair, err := s.GenerateTokenPair(user.Email, user.IsAdmin, deviceID)
	if err != nil {
		// Failed to generate/store new tokens, return error WITHOUT revoking old one
		return nil, fmt.Errorf("failed to generate new token pair: %w", err)
	}

	// 6. Successfully generated new pair, NOW revoke the OLD refresh token
	// It's okay if revocation fails, the old token will expire eventually.
	// The user has the new valid token pair.
	err = s.repo.RefreshTokens.Delete(refreshToken) // Marks the old token as revoked
	if err != nil {
		// Log this failure but don't fail the refresh operation
		// s.log.Warnw("Failed to revoke old refresh token after successful refresh", "error", err, "old_token", refreshToken)
		fmt.Printf("Warning: Failed to revoke old refresh token %s after successful refresh: %v\n", refreshToken, err)
	}

	// 7. Return the NEW token pair
	return newTokenPair, nil
}

// ValidateToken verifies a token and returns claims
func (s *AuthService) ValidateToken(tokenString string) (*CustomClaims, error) {
	if s.JWTConfig == nil {
		return nil, fmt.Errorf("JWT not initialized")
	}

	// Parse the token
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (any, error) {
		// Validate the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		return []byte(s.JWTConfig.Secret), nil
	})

	if err != nil {
		return nil, fmt.Errorf("token parsing failed: %w", err)
	}

	// Check if the token is valid
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	// Get the claims
	claims, ok := token.Claims.(*CustomClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	// Check if token has been revoked in the database
	isRevoked, err := s.repo.RevokedTokens.IsTokenRevoked(claims.TokenID)
	if err != nil {
		// Log DB error but treat as potentially revoked for security
		// s.log.Errorw("Failed to check token revocation status", "error", err, "token_id", claims.TokenID)
		fmt.Printf("Error checking token revocation for %s: %v\n", claims.TokenID, err)
		return nil, fmt.Errorf("failed to verify token status")
	}
	if isRevoked {
		return nil, fmt.Errorf("token has been revoked")
	}

	return claims, nil
}

// RevokeToken invalidates a token by its ID
func (s *AuthService) RevokeToken(tokenID string) error {
	// Find the refresh token associated with this access token ID to get user email
	// Note: This assumes a 1:1 link between access token ID and a refresh token record.
	// If multiple refresh tokens could share a TokenID, this needs adjustment.
	refreshToken, err := s.repo.RefreshTokens.GetByTokenID(tokenID)
	if err != nil {
		// s.log.Warnw("Could not find refresh token for token ID to revoke", "token_id", tokenID, "error", err)
		// Still attempt to add to revoked tokens table directly
		fmt.Printf("Warning: Could not find refresh token for token ID %s to revoke: %v\n", tokenID, err)
	}

	userEmail := ""
	if refreshToken != nil {
		userEmail = refreshToken.UserEmail
		// Also revoke the specific refresh token itself
		if err := s.repo.RefreshTokens.Delete(refreshToken.Token); err != nil {
			// s.log.Warnw("Failed to revoke associated refresh token during token revocation", "error", err, "refresh_token", refreshToken.Token)
			fmt.Printf("Warning: Failed to revoke associated refresh token %s: %v\n", refreshToken.Token, err)
		}
	}

	// Add the access token's ID to the revoked list
	return s.repo.RevokedTokens.RevokeToken(tokenID, userEmail) // Pass userEmail if available
}

// RevokeAllUserTokens invalidates all tokens for a user
func (s *AuthService) RevokeAllUserTokens(email string) error {
	return s.repo.RevokedTokens.RevokeAllUserTokens(email)
}

// GeneratePasswordResetToken creates a token for password reset
func (s *AuthService) GeneratePasswordResetToken(email string) (string, error) {
	// Check if user exists
	_, err := s.repo.Users.GetByEmail(email)
	if err != nil {
		return "", fmt.Errorf("user not found: %w", err)
	}

	// Create a reset token (valid for 30 minutes)
	token, err := s.repo.PasswordResetTokens.Create(email, 30)
	if err != nil {
		return "", fmt.Errorf("failed to create reset token: %w", err)
	}

	return token.Token, nil
}

// ValidatePasswordResetToken checks if a password reset token is valid
func (s *AuthService) ValidatePasswordResetToken(tokenStr string) (string, error) {
	token, err := s.repo.PasswordResetTokens.ValidatePasswordResetToken(tokenStr)
	if err != nil {
		return "", fmt.Errorf("invalid or expired token: %w", err)
	}

	return token.UserEmail, nil
}

// ResetPassword completes the password reset process
func (s *AuthService) ResetPassword(tokenStr string, newPassword string) error {
	// Validate token
	userEmail, err := s.ValidatePasswordResetToken(tokenStr)
	if err != nil {
		return err
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	// Update user's password
	if err := s.repo.Users.UpdatePassword(userEmail, hashedPassword); err != nil {
		return fmt.Errorf("failed to update password: %w", err)
	}

	// Mark token as used
	if err := s.repo.PasswordResetTokens.MarkTokenAsUsed(tokenStr); err != nil {
		return fmt.Errorf("failed to mark token as used: %w", err)
	}

	return nil
}
