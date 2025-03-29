package utils

import (
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/golang-jwt/jwt/v4"
)

// Store config reference
var jwtConfig *config.JWTConfig

// CustomClaims defines the claims in the JWT token
type CustomClaims struct {
	Email   string `json:"email"`
	IsAdmin bool   `json:"is_admin"`
	jwt.RegisteredClaims
}

// InitJWT initializes JWT with config
func InitJWT(cfg *config.JWTConfig) {
	jwtConfig = cfg
}

// GenerateJWT generates a JWT token for a user
func GenerateJWT(email string, isAdmin bool) (string, error) {
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

// ValidateJWT validates a JWT token and returns the claims
func ValidateJWT(tokenString string) (*CustomClaims, error) {
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
