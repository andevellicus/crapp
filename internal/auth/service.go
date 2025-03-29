// internal/auth/service.go
package auth

import (
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/golang-jwt/jwt/v4"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	repo      *repository.Repository
	tokenTTL  time.Duration
	secretKey string
}

// CustomClaims defines the claims in the JWT token
type CustomClaims struct {
	Email   string `json:"email"`
	IsAdmin bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

func NewAuthService(repo *repository.Repository, tokenTTL time.Duration, secretKey string) *AuthService {
	return &AuthService{
		repo:      repo,
		tokenTTL:  tokenTTL,
		secretKey: secretKey,
	}
}

// Store config reference
var jwtConfig *config.JWTConfig

// InitJWT initializes JWT with config
func InitJWT(cfg *config.JWTConfig) {
	jwtConfig = cfg
}

// Authenticate validates credentials and returns user with session
func (s *AuthService) Authenticate(email, password string, deviceInfo map[string]interface{}) (*models.User, *models.Device, string, error) {
	// Get user
	user, err := s.repo.GetUser(email)
	if err != nil {
		return nil, nil, "", err
	}

	// Verify password
	err = bcrypt.CompareHashAndPassword(user.Password, []byte(password))
	if err != nil {
		return nil, nil, "", err
	}

	// Register device
	device, err := s.repo.RegisterDevice(email, deviceInfo)
	if err != nil {
		return nil, nil, "", err
	}

	// Generate token
	token, err := s.GenerateToken(email, user.IsAdmin)
	if err != nil {
		return nil, nil, "", err
	}

	// Update last login time
	user.LastLogin = time.Now()
	if err := s.repo.UpdateUser(user); err != nil {
		return nil, nil, "", err
	}

	return user, device, token, nil
}

// GenerateToken creates a new JWT token
func (s *AuthService) GenerateToken(email string, isAdmin bool) (string, error) {
	if jwtConfig == nil {
		return "", fmt.Errorf("JWT not initialized")
	}

	// Set token expiration time (24 hours)
	expirationTime := time.Now().Add(time.Duration(jwtConfig.Expires) * time.Hour)

	// Create the claims
	claims := &CustomClaims{
		Email:   email,
		IsAdmin: isAdmin,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "crapp",
			Subject:   email,
		},
	}

	// Create and sign the token
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(jwtConfig.Secret))

	return tokenString, err
}

// ValidateToken verifies a token and returns claims
func (s *AuthService) ValidateToken(tokenString string) (*CustomClaims, error) {
	if jwtConfig == nil {
		return nil, fmt.Errorf("JWT not initialized")
	}

	// Parse the token
	token, err := jwt.ParseWithClaims(tokenString, &CustomClaims{}, func(token *jwt.Token) (any, error) {
		// Validate the signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		return []byte(jwtConfig.Secret), nil
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

	return claims, nil
}
