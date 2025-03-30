// internal/repository/token.go
package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

// SaveRefreshToken stores a refresh token in the database
func (r *Repository) SaveRefreshToken(token *models.RefreshToken) error {
	return r.db.Create(token).Error
}

// GetRefreshToken retrieves a refresh token from the database
func (r *Repository) GetRefreshToken(tokenString string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.db.Where("token = ? AND revoked_at IS NULL", tokenString).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

// DeleteRefreshToken removes a refresh token from the database
func (r *Repository) DeleteRefreshToken(tokenString string) error {
	now := time.Now()
	return r.db.Model(&models.RefreshToken{}).
		Where("token = ?", tokenString).
		Update("revoked_at", &now).
		Error
}

// RevokeToken marks a token as revoked
func (r *Repository) RevokeToken(tokenID string) error {
	// Check if token is already revoked
	var count int64
	r.db.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count)
	if count > 0 {
		return nil // Already revoked
	}

	// Add to revoked tokens
	revokedToken := models.RevokedToken{
		TokenID:   tokenID,
		RevokedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour), // Keep record for 24 hours (for cleanup)
	}

	return r.db.Create(&revokedToken).Error
}

// IsTokenRevoked checks if a token has been revoked
func (r *Repository) IsTokenRevoked(tokenID string) (bool, error) {
	var count int64
	err := r.db.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count).Error
	return count > 0, err
}

// RevokeAllUserTokens revokes all tokens for a user
func (r *Repository) RevokeAllUserTokens(email string) error {
	// Revoke all refresh tokens
	now := time.Now()
	if err := r.db.Model(&models.RefreshToken{}).
		Where("user_email = ? AND revoked_at IS NULL", email).
		Update("revoked_at", &now).
		Error; err != nil {
		return err
	}

	// Get all active refresh tokens to find token IDs
	var tokens []models.RefreshToken
	if err := r.db.Where("user_email = ? AND revoked_at IS NULL", email).Find(&tokens).Error; err != nil {
		return err
	}

	// Add all token IDs to revoked tokens
	for _, token := range tokens {
		r.RevokeToken(token.TokenID)
	}

	return nil
}

// CleanupExpiredTokens removes expired tokens
func (r *Repository) CleanupExpiredTokens() error {
	now := time.Now()

	// Delete expired refresh tokens
	if err := r.db.Where("expires_at < ?", now).Delete(&models.RefreshToken{}).Error; err != nil {
		return err
	}

	// Delete expired revoked tokens
	if err := r.db.Where("expires_at < ?", now).Delete(&models.RevokedToken{}).Error; err != nil {
		return err
	}

	return nil
}
