package repository

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type UserRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
	cfg *config.Config
}

// UserNotificationPreferences represents a user's complete notification preferences
type UserNotificationPreferences struct {
	// Push notification preferences
	PushEnabled bool `json:"push_enabled"`
	// Email notification preferences
	EmailEnabled bool `json:"email_enabled"`
	// Shared reminder time settings
	ReminderTimes []string `json:"reminder_times"`
	// Time when user can still complete yesterday's assessment
	CutoffTime string `json:"cutoff_time,omitempty"`
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB, log *zap.SugaredLogger, cfg *config.Config) *UserRepository {
	return &UserRepository{
		db:  db,
		log: log.Named("user-repo"),
		cfg: cfg,
	}
}

func (r *UserRepository) Create(user *models.User) error {
	if err := r.validateUser(user); err != nil {
		return fmt.Errorf("invalid user data: %w", err)
	}

	// Initialize default notification preferences if not set
	if user.NotificationPreferences == "" {
		defaultPrefs := UserNotificationPreferences{
			PushEnabled:   false,
			EmailEnabled:  false,
			ReminderTimes: r.cfg.Reminders.Times,
			CutoffTime:    r.cfg.Reminders.CutoffTime,
		}

		prefsJSON, err := json.Marshal(defaultPrefs)
		if err != nil {
			r.log.Errorw("Error marshaling default notification preferences", "error", err)
			return fmt.Errorf("failed to create user: %w", err)
		}

		user.NotificationPreferences = string(prefsJSON)
	}

	if err := r.db.Create(user).Error; err != nil {
		r.log.Errorw("Database error creating user", "email", user.Email, "error", err)
		return fmt.Errorf("failed to create user: %w", err)
	}
	return nil
}

func (r *UserRepository) UpdateUserName(user *models.User) error {
	// Business rule validation
	if err := r.validateUser(user); err != nil {
		return fmt.Errorf("invalid user data: %w", err)
	}

	// Perform update, excluding password field
	result := r.db.Model(&models.User{}).
		Where("LOWER(email) = ?", user.Email).
		Updates(map[string]any{
			"first_name": user.FirstName,
			"last_name":  user.LastName,
		})

	if result.Error != nil {
		r.log.Errorw("Database error updationg user name", "email", user.Email, "error", result.Error)
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	return nil
}

func (r *UserRepository) LastAssessmentNow(email string) error {
	normalizedEmail := strings.ToLower(email)
	result := r.db.Model(&models.User{}).
		Where("LOWER(email) = ?", normalizedEmail).
		Updates(map[string]any{
			"last_assessment_date": time.Now(),
		})
	if result.Error != nil {
		r.log.Errorw("Database error updating last assessment date", "email", normalizedEmail, "error", result.Error)
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	return nil
}

func (r *UserRepository) LastLoginNow(email string) error {
	normalizedEmail := strings.ToLower(email)
	result := r.db.Model(&models.User{}).
		Where("LOWER(email) = ?", normalizedEmail).
		Updates(map[string]any{
			"last_login": time.Now(),
		})
	if result.Error != nil {
		r.log.Errorw("Database error updating last login date", "email", normalizedEmail, "error", result.Error)
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	return nil
}

func (r *UserRepository) Delete(email string) error {
	// Start a transaction
	tx := r.db.Begin()
	if tx.Error != nil {
		return fmt.Errorf("failed to begin transaction: %w", tx.Error)
	}

	// Find assessment IDs for the user first
	var assessmentIDs []uint
	if err := tx.Model(&models.Assessment{}).Where("LOWER(user_email) = ?", email).Pluck("id", &assessmentIDs).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error finding assessments for user %s: %w", email, err)
	}

	// Only proceed if there are assessments to deal with
	if len(assessmentIDs) > 0 {
		// Delete assessment_metrics first
		if err := tx.Where("assessment_id IN (?)", assessmentIDs).Delete(&models.AssessmentMetric{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting assessment metrics: %w", err)
		}

		// Delete question responses next
		if err := tx.Where("assessment_id IN (?)", assessmentIDs).Delete(&models.QuestionResponse{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting question responses: %w", err)
		}

		// Delete CPT results linked to these assessments
		if err := tx.Where("assessment_id IN (?)", assessmentIDs).Delete(&models.CPTResult{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting assessment CPT results: %w", err)
		}

		// Delete TMT results linked to these assessments
		if err := tx.Where("assessment_id IN (?)", assessmentIDs).Delete(&models.TMTResult{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting assessment TMT results: %w", err)
		}

		// Delete form states
		if err := tx.Delete(&models.FormState{}, "LOWER(user_email)  = ?", email).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting form states: %w", err)
		}

		// --- Now delete the assessments themselves ---
		if err := tx.Where("id IN (?)", assessmentIDs).Delete(&models.Assessment{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting assessments for user %s: %w", email, err)
		}
	} else {
		// If there were no assessments, still need to delete any dangling form states
		// (e.g., states that were started but never submitted/linked)
		if err := tx.Where("LOWER(user_email)  = ? AND assessment_id IS NULL", email).Delete(&models.FormState{}).Error; err != nil {
			tx.Rollback()
			return fmt.Errorf("error deleting dangling form states: %w", err)
		}
	}

	// Delete refresh tokens
	if err := tx.Delete(&models.RefreshToken{}, "LOWER(user_email)  = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting refresh tokens: %w", err)
	}

	// Delete revoked tokens
	if err := tx.Delete(&models.RevokedToken{}, "LOWER(user_email)  = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting revoked tokens: %w", err)
	}

	// Delete password reset tokens
	if err := tx.Delete(&models.PasswordResetToken{}, "LOWER(user_email)  = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting password reset tokens: %w", err)
	}

	// Delete devices
	if err := tx.Delete(&models.Device{}, "LOWER(user_email)  = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting devices: %w", err)
	}

	// Finally, delete the user
	if err := tx.Delete(&models.User{}, "LOWER(user_email)  = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting user: %w", err)
	}

	// Commit transaction
	return tx.Commit().Error
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	if email == "" {
		return nil, fmt.Errorf("email cannot be empty")
	}

	normalizedEmail := strings.ToLower(email)

	var user models.User
	result := r.db.Model(&models.User{}).Where("LOWER(email) = ?", normalizedEmail).First(&user)
	if result.Error != nil {
		// Log the raw error FIRST
		r.log.Warnw("Raw database error during GetByEmail query",
			"email", normalizedEmail,
			"error_type", fmt.Sprintf("%T", result.Error),
			"error", result.Error)

		// Use errors.Is for more reliable error checking
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			r.log.Infow("User specifically not found via GetByEmail", "email", normalizedEmail)
			// Return a specific "not found" error
			return nil, fmt.Errorf("user %s not found", normalizedEmail)
		}
		// Add a check for RowsAffected as a safeguard (optional but good practice)
		if result.RowsAffected == 0 {
			r.log.Warnw("GetByEmail query succeeded without error but RowsAffected is 0", "email", normalizedEmail)
			return nil, fmt.Errorf("user %s not found (RowsAffected=0)", normalizedEmail)
		}

		// Log other errors more severely
		r.log.Errorw("Unexpected database error getting user by email", "email", normalizedEmail, "error", result.Error)
		return nil, result.Error // Return the original DB error for other cases
	}
	return &user, nil
}

// UserExists checks if a user with the given email exists
func (r *UserRepository) UserExists(email string) (bool, error) {
	normalizedEmail := strings.ToLower(email)

	var count int64
	result := r.db.Model(&models.User{}).Where("LOWER(email) = ?", normalizedEmail).Count(&count)
	if result.Error != nil {
		r.log.Errorw("Database error checking user existence", "email", normalizedEmail, "error", result.Error)
		return false, result.Error
	}
	return count > 0, nil
}

// UpdatePassword updates a user's password
func (r *UserRepository) UpdatePassword(email string, hashedPassword []byte) error {
	normalizedEmail := strings.ToLower(email)
	result := r.db.Model(&models.User{}).
		Where("LOWER(email) = ?", normalizedEmail).
		Update("password", hashedPassword)
	if result.Error != nil {
		r.log.Errorw("Database error updating user password", "email", normalizedEmail, "error", result.Error)
		return result.Error
	}
	return nil
}

// Check if user has already completed assessment for today
func (r *UserRepository) HasCompletedAssessment(email string) (bool, error) {
	normalizedEmail := strings.ToLower(email)
	var count int64
	today := time.Now().Truncate(24 * time.Hour).Format("2006-01-02") // Start of today

	err := r.db.Model(&models.User{}).
		Where("LOWER(email) = ? AND last_assessment_date >= ?", normalizedEmail, today).
		Count(&count).Error

	return count > 0, err
}

// SavePushSubscription saves a push subscription for a user
func (r *UserRepository) SavePushSubscription(email string, subscription string) error {
	normalizedEmail := strings.ToLower(email)
	// Update user record with push subscription
	var user models.User
	if err := r.db.Where("LOWER(email) = ?", normalizedEmail).First(&user).Error; err != nil {
		return err
	}

	// Update user model to include push_subscription field
	if err := r.db.Model(&user).Update("push_subscription", subscription).Error; err != nil {
		return err
	}

	return nil
}

// SaveNotificationPreferences saves a user's complete notification preferences
func (r *UserRepository) SaveNotificationPreferences(email string, preferences *UserNotificationPreferences) error {
	normalizedEmail := strings.ToLower(email)
	// Convert preferences to JSON
	preferencesJSON, err := json.Marshal(preferences)
	if err != nil {
		return err
	}

	result := r.db.Model(&models.User{}).
		Where("LOWER(email) = ?", normalizedEmail).
		Update("notification_preferences", string(preferencesJSON))

	if result.Error != nil {
		r.log.Errorw("Failed to update notification preferences",
			"error", result.Error,
			"email", normalizedEmail)
		return result.Error
	}

	return nil
}

// GetPushSubscription gets a user's push subscription
func (r *UserRepository) GetPushSubscription(email string) (string, error) {
	normalizedEmail := strings.ToLower(email)
	var user models.User
	if err := r.db.Where("LOWER(email) = ?", normalizedEmail).First(&user).Error; err != nil {
		return "", err
	}

	return user.PushSubscription, nil
}

// GetPushPreferences gets a user's push notification preferences
func (r *UserRepository) GetNotificationPreferences(email string) (*UserNotificationPreferences, error) {
	normalizedEmail := strings.ToLower(email)
	var user models.User
	if err := r.db.Where("LOWER(email) = ?", normalizedEmail).First(&user).Error; err != nil {
		return nil, err
	}

	// Default preferences if none are set
	if user.NotificationPreferences == "" {
		return &UserNotificationPreferences{
			PushEnabled:   false,
			EmailEnabled:  false,
			ReminderTimes: []string{"20:00"},
			CutoffTime:    "10:00",
		}, nil
	}

	var preferences UserNotificationPreferences
	if err := json.Unmarshal([]byte(user.NotificationPreferences), &preferences); err != nil {
		return nil, err
	}

	return &preferences, nil
}

// SearchUsers searches for users by email or name
func (r *UserRepository) SearchUsers(query string, skip, limit int) (*[]models.User, int64, error) {
	var users []models.User
	var total int64

	// Start with the base model query
	queryBuilder := r.db.Model(&models.User{}) // Use a separate variable for the query builder

	// Apply the search filter if a query is provided
	if query != "" {
		searchQuery := "%" + strings.ToLower(query) + "%" // Use ToLower here
		// Apply the WHERE clause for searching email, first name, or last name (case-insensitive)
		queryBuilder = queryBuilder.Where("LOWER(email) LIKE ? OR LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ?", searchQuery, searchQuery, searchQuery)
	}

	// Count the total matching users *after* applying the filter
	if err := queryBuilder.Count(&total).Error; err != nil {
		r.log.Errorw("Database error counting users", "error", err, "query", query)
		return nil, 0, err
	}

	// Retrieve the paginated users *after* applying the filter and ordering
	result := queryBuilder.Order("email").Offset(skip).Limit(limit).Find(&users)
	if result.Error != nil {
		r.log.Errorw("Database error searching users", "error", result.Error, "query", query)
		return nil, 0, result.Error
	}

	// Don't return password hashes
	for i := range users {
		users[i].Password = nil
	}

	return &users, total, nil
}

// Helper method for validation
func (r *UserRepository) validateUser(user *models.User) error {
	if user.Email == "" {
		return fmt.Errorf("email cannot be empty")
	}

	if len(user.FirstName) > 100 {
		return fmt.Errorf("first name too long (max 100 characters)")
	}

	return nil
}
