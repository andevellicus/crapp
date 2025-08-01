// internal/repository/token_repository.go
package repository

import (
	"fmt"
	"strings"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ----- RefreshToken Repository -----

type RefreshTokenRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

func NewRefreshTokenRepository(db *gorm.DB, log *zap.SugaredLogger) *RefreshTokenRepository {
	return &RefreshTokenRepository{
		db:  db,
		log: log.Named("refresh-tok-repo"),
	}
}

func (r *RefreshTokenRepository) Create(refreshToken *models.RefreshToken) error {
	if err := r.db.Create(refreshToken).Error; err != nil {
		r.log.Errorw("Database error creating refresh token", "error", err)
		return fmt.Errorf("failed to create refresh token: %w", err)
	}
	return nil
}

// GetByTokenID retrieves a refresh token by its associated access token ID (TokenID)
func (r *RefreshTokenRepository) GetByTokenID(tokenID string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	// Find the most recent non-revoked token associated with this TokenID
	err := r.db.Where("token_id = ? AND revoked_at IS NULL", tokenID).Order("created_at DESC").First(&token).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("refresh token not found for token ID %s", tokenID)
		}
		r.log.Errorw("Database error getting refresh token by token ID", "token_id", tokenID, "error", err)
		return nil, err
	}
	return &token, nil
}

// GetByRefreshTokenString retrieves a refresh token by its actual token string (primary key)
func (r *RefreshTokenRepository) GetByRefreshTokenString(tokenString string) (*models.RefreshToken, error) {
	var token models.RefreshToken
	// Query using the 'token' column, which is the primary key
	err := r.db.Where("token = ? AND revoked_at IS NULL", tokenString).First(&token).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, fmt.Errorf("refresh token not found: %s", tokenString) // Specific error
		}
		r.log.Errorw("Database error getting refresh token by string", "token", tokenString, "error", err)
		return nil, err
	}
	// Check expiry here as well for an early exit
	if token.ExpiresAt.Before(time.Now()) {
		// Optionally delete the expired token now
		// r.db.Delete(&token)
		return nil, fmt.Errorf("refresh token expired")
	}
	return &token, nil
}

// GetAllActiveForUser retrieves all non-revoked refresh tokens for a user
func (r *RefreshTokenRepository) GetAllActiveForUser(email string) ([]models.RefreshToken, error) {
	normalizedEmail := strings.ToLower(email)
	var tokens []models.RefreshToken
	err := r.db.Where("LOWER(user_email) = ? AND revoked_at IS NULL", normalizedEmail).Find(&tokens).Error
	if err != nil {
		r.log.Errorw("Database error getting all active refresh tokens for user", "user_email", normalizedEmail, "error", err)
		return nil, err
	}
	return tokens, nil
}

func (r *RefreshTokenRepository) Delete(tokenString string) error {
	now := time.Now()
	return r.db.Model(&models.RefreshToken{}).
		Where("token = ?", tokenString).
		Update("revoked_at", &now).
		Error
}

// ----- RevokedToken Repository -----

type RevokedTokenRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
}

func NewRevokedTokenRepository(db *gorm.DB, log *zap.SugaredLogger) *RevokedTokenRepository {
	return &RevokedTokenRepository{
		db:  db,
		log: log.Named("revoke-tok-repo"),
	}
}

func (r *RevokedTokenRepository) Create(revokedToken *models.RevokedToken) error {
	if err := r.db.Create(revokedToken).Error; err != nil {
		r.log.Errorw("Database error creating revoked token", "error", err)
		return fmt.Errorf("failed to create revoked token: %w", err)
	}
	return nil
}

// Specialized methods
func (r *RevokedTokenRepository) IsTokenRevoked(tokenID string) (bool, error) {
	var count int64
	err := r.db.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count).Error
	return count > 0, err
}

func (r *RevokedTokenRepository) RevokeToken(tokenID string, email string) error {
	normalizedEmail := strings.ToLower(email)
	// Check if token is already revoked
	var count int64
	r.db.Model(&models.RevokedToken{}).Where("token_id = ?", tokenID).Count(&count)
	if count > 0 {
		return nil // Already revoked
	}

	// Add to revoked tokens
	revokedToken := models.RevokedToken{
		TokenID:   tokenID,
		UserEmail: normalizedEmail, // Store the user email
		RevokedAt: time.Now(),
		ExpiresAt: time.Now().Add(48 * time.Hour), // Keep record longer (e.g., 48 hours)
	}

	if err := r.Create(&revokedToken); err != nil {
		return err
	}

	return nil
}

// RevokeAllUserTokens revokes all tokens for a user
func (r *RevokedTokenRepository) RevokeAllUserTokens(email string) error {
	normalizedEmail := strings.ToLower(email)
	// Revoke all refresh tokens
	now := time.Now()
	if err := r.db.Model(&models.RefreshToken{}).
		Where("LOWER(user_email) = ? AND revoked_at IS NULL", normalizedEmail).
		Update("revoked_at", &now).
		Error; err != nil {
		return err
	}

	// Get all active refresh tokens to find token IDs
	var tokens []models.RefreshToken
	if err := r.db.Where("LOWER(user_email) = ? AND revoked_at IS NULL", normalizedEmail).Find(&tokens).Error; err != nil {
		return err
	}

	// Add all token IDs to revoked tokens
	for _, token := range tokens {
		r.RevokeToken(token.TokenID, normalizedEmail)
	}

	return nil
}

// ----- PasswordResetToken Repository -----

type PasswordTokenRepository struct {
	db       *gorm.DB
	log      *zap.SugaredLogger
	userRepo *UserRepository
}

func NewPasswordTokenRepository(db *gorm.DB, log *zap.SugaredLogger, userRepo *UserRepository) *PasswordTokenRepository {
	return &PasswordTokenRepository{
		db:       db,
		log:      log.Named("pwd-reset-tok-repo"),
		userRepo: userRepo,
	}
}

// Specialized methods
func (r *PasswordTokenRepository) Create(email string, expiresInMinutes int) (*models.PasswordResetToken, error) {
	normalizedEmail := strings.ToLower(email)
	// Check if user exists using the User repository
	exists, err := r.userRepo.UserExists(normalizedEmail)
	if err != nil {
		return nil, fmt.Errorf("error checking user: %w", err)
	}

	if !exists {
		return nil, fmt.Errorf("user not found: %s", normalizedEmail)
	}

	// Generate a new token
	tokenStr := generateUniqueToken()

	// Expire old tokens for this user
	if err := r.db.Model(&models.PasswordResetToken{}).
		Where("LOWER(user_email) = ? AND used_at IS NULL", normalizedEmail).
		Update("used_at", time.Now()).Error; err != nil {
		r.log.Warnw("Failed to expire old password reset tokens", "error", err)
	}

	// Create new token
	token := &models.PasswordResetToken{
		Token:     tokenStr,
		UserEmail: normalizedEmail,
		ExpiresAt: time.Now().Add(time.Duration(expiresInMinutes) * time.Minute),
		CreatedAt: time.Now(),
	}

	if err := r.db.Create(token).Error; err != nil {
		return nil, err
	}

	return token, nil
}

func (r *PasswordTokenRepository) ValidatePasswordResetToken(tokenStr string) (*models.PasswordResetToken, error) {
	var token models.PasswordResetToken
	err := r.db.Where("token = ? AND used_at IS NULL AND expires_at > ?", tokenStr, time.Now()).First(&token).Error
	if err != nil {
		return nil, err
	}
	return &token, nil
}

func (r *PasswordTokenRepository) MarkTokenAsUsed(tokenStr string) error {
	now := time.Now()
	return r.db.Model(&models.PasswordResetToken{}).
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

// Helper function to generate a unique token
func generateUniqueToken() string {
	return uuid.New().String()
}
