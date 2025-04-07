// internal/auth/service.go
package auth

import (
	"fmt"
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
	jwtConfig       *config.JWTConfig
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

func NewAuthService(repo *repository.Repository, cfg *config.JWTConfig) *AuthService {
	return &AuthService{
		repo:            repo,
		tokenTTL:        time.Duration(cfg.Expires) * time.Minute,           // Short-lived access token
		refreshTokenTTL: time.Duration(cfg.RefreshExpires) * time.Hour * 24, // Longer-lived refresh token (days)
		secretKey:       cfg.Secret,
		jwtConfig:       cfg,
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
		return nil, nil, nil, err
	}

	// Get user
	user, err := s.repo.Users.GetByEmail(email)
	if err != nil {
		return nil, nil, nil, err
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword(user.Password, []byte(password))
	if err != nil {
		return nil, nil, nil, err
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
		return nil, err
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
		return nil, err
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
	notBeforeTime := time.Now().Add(s.jwtConfig.NotBefore)

	claims := &CustomClaims{
		Email:   email,
		IsAdmin: isAdmin,
		TokenID: tokenID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(notBeforeTime),
			Issuer:    s.jwtConfig.Issuer,
			Audience:  []string{s.jwtConfig.Audience},
			Subject:   email,
			ID:        tokenID, // JWT ID
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(s.jwtConfig.Secret))

	return tokenString, err
}

// RefreshToken generates a new access token using a refresh token
func (s *AuthService) RefreshToken(refreshToken string, deviceID string) (*TokenPair, error) {
	// Validate the refresh token
	storedToken, err := s.repo.RefreshTokens.Get(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	// Check if token is expired
	if storedToken.ExpiresAt.Before(time.Now()) {
		// Delete expired token
		s.repo.RefreshTokens.Delete(refreshToken)
		return nil, fmt.Errorf("refresh token expired")
	}

	// Check if token belongs to this device
	if storedToken.DeviceID != deviceID {
		return nil, fmt.Errorf("invalid device for refresh token")
	}

	// Get user
	user, err := s.repo.Users.GetByEmail(storedToken.UserEmail)
	if err != nil {
		return nil, err
	}

	// Invalidate old refresh token
	s.repo.RefreshTokens.Delete(refreshToken)

	// Generate new token pair
	return s.GenerateTokenPair(user.Email, user.IsAdmin, deviceID)
}

// ValidateToken verifies a token and returns claims
func (s *AuthService) ValidateToken(tokenString string) (*CustomClaims, error) {
	if s.jwtConfig == nil {
		return nil, fmt.Errorf("JWT not initialized")
	}

	// Parse the token
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (any, error) {
		// Validate the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		return []byte(s.jwtConfig.Secret), nil
	})

	if err != nil {
		return nil, err
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

	// Check if token has been revoked
	isRevoked, err := s.repo.RevokedTokens.IsTokenRevoked(claims.TokenID)
	if err != nil || isRevoked {
		return nil, fmt.Errorf("token has been revoked")
	}

	return claims, nil
}

// RevokeToken invalidates a token by its ID
func (s *AuthService) RevokeToken(tokenID string) error {
	return s.repo.RevokedTokens.RevokeToken(tokenID)
}

// RevokeAllUserTokens invalidates all tokens for a user
func (s *AuthService) RevokeAllUserTokens(email string) error {
	return s.repo.RevokedTokens.RevokeAllUserTokens(email)
}
