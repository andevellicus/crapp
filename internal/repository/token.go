// internal/repository/token_repository.go
package repository

import (
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ----- RefreshToken Repository -----

type RefreshTokenRepository struct {
	Base *BaseRepository[models.RefreshToken]
}

func NewRefreshTokenRepository(db *gorm.DB, log *zap.SugaredLogger) *RefreshTokenRepository {
	return &RefreshTokenRepository{
		Base: NewBaseRepository[models.RefreshToken](db, log.Named("refresh_token"), "refresh_tokens"),
	}
}

// Specialized methods
func (r *RefreshTokenRepository) GetRefreshToken(tokenString string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	err := r.Base.DB.Where("token = ? AND revoked_at IS NULL", tokenString).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *RefreshTokenRepository) Delete(tokenString string) error {
	now := time.Now()
	return r.Base.DB.Model(&models.RefreshToken{}).
		Where("token = ?", tokenString).
		Update("revoked_at", &now).
		Error
}

// ----- RevokedToken Repository -----

type RevokedTokenRepository struct {
	Base *BaseRepository[models.RevokedToken]
}

func NewRevokedTokenRepository(db *gorm.DB, log *zap.SugaredLogger) *RevokedTokenRepository {
	return &RevokedTokenRepository{
		Base: NewBaseRepository[models.RevokedToken](db, log.Named("revoked_token"), "revoked_tokens"),
	}
}

// Specialized methods
func (r *RevokedTokenRepository) IsTokenRevoked(tokenID string) (bool, error) {
	var count int64
	err := r.Base.DB.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count).Error
	return count > 0, err
}

func (r *RevokedTokenRepository) RevokeToken(tokenID string) error {
	// Check if token is already revoked
	var count int64
	r.Base.DB.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count)
	if count > 0 {
		return nil // Already revoked
	}

	// Add to revoked tokens
	revokedToken := models.RevokedToken{
		TokenID:   tokenID,
		RevokedAt: time.Now(),
		ExpiresAt: time.Now().Add(24 * time.Hour), // Keep record for 24 hours (for cleanup)
	}

	return r.Base.Create(&revokedToken)
}

// ----- PasswordResetToken Repository -----

type PasswordTokenRepository struct {
	Base *BaseRepository[models.PasswordResetToken]
}

func NewPasswordTokenRepository(db *gorm.DB, log *zap.SugaredLogger) *PasswordTokenRepository {
	return &PasswordTokenRepository{
		Base: NewBaseRepository[models.PasswordResetToken](db, log.Named("password_token"), "password_reset_tokens"),
	}
}

// Specialized methods
func (r *PasswordTokenRepository) Create(userEmail string, expiresInMinutes int) (*models.PasswordResetToken, error) {
	// Check if user exists using the User repository
	var userCount int64
	if err := r.Base.DB.Model(&models.User{}).Where("email = ?", userEmail).Count(&userCount).Error; err != nil {
		return nil, fmt.Errorf("error checking user: %w", err)
	}

	if userCount == 0 {
		return nil, fmt.Errorf("user not found: %s", userEmail)
	}

	// Generate a new token
	tokenStr := generateUniqueToken() // You'll need to implement this or use uuid package

	// Expire old tokens for this user
	if err := r.Base.DB.Model(&models.PasswordResetToken{}).
		Where("user_email = ? AND used_at IS NULL", userEmail).
		Update("used_at", time.Now()).Error; err != nil {
		r.Base.Log.Warnw("Failed to expire old password reset tokens", "error", err)
	}

	// Create new token
	token := &models.PasswordResetToken{
		Token:     tokenStr,
		UserEmail: userEmail,
		ExpiresAt: time.Now().Add(time.Duration(expiresInMinutes) * time.Minute),
		CreatedAt: time.Now(),
	}

	if err := r.Base.Create(token); err != nil {
		return nil, err
	}

	return token, nil
}

func (r *PasswordTokenRepository) ValidatePasswordResetToken(tokenStr string) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := r.Base.DB.Where("token = ? AND used_at IS NULL AND expires_at > ?", tokenStr, time.Now()).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *PasswordTokenRepository) MarkTokenAsUsed(tokenStr string) error {
	now := time.Now()
	return r.Base.DB.Model(&models.PasswordResetToken{}).
		Where("token = ?", tokenStr).
		Update("used_at", &now).Error
}

// Implement CleanupExpiredTokens for backwards compatibility
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
		r.RevokedTokens.RevokeToken(token.TokenID)
	}

	return nil
}

// Helper function to generate a unique token
func generateUniqueToken() string {
	//return fmt.Sprintf("token_%d", time.Now().UnixNano())
	return uuid.New().String()
}
