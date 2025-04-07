package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type UserRepository struct {
	db  *gorm.DB
	log *zap.SugaredLogger
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
func NewUserRepository(db *gorm.DB, log *zap.SugaredLogger) *UserRepository {
	return &UserRepository{
		db:  db,
		log: log.Named("user-repo"),
	}
}

func (r *UserRepository) Create(user *models.User) error {
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
		Where("email = ?", user.Email).
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
	result := r.db.Model(&models.User{}).
		Where("email = ?", email).
		Updates(map[string]any{
			"last_assessment_date": time.Now(),
		})
	if result.Error != nil {
		r.log.Errorw("Database error updating last assessment date", "email", email, "error", result.Error)
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	return nil
}

func (r *UserRepository) LastLoginNow(email string) error {
	result := r.db.Model(&models.User{}).
		Where("email = ?", email).
		Updates(map[string]any{
			"last_login": time.Now(),
		})
	if result.Error != nil {
		r.log.Errorw("Database error updating last login date", "email", email, "error", result.Error)
		return fmt.Errorf("failed to update user: %w", result.Error)
	}

	return nil
}

func (r *UserRepository) Delete(email string) error {
	// Start a transaction
	tx := r.db.Begin()

	// Delete form states
	if err := tx.Delete(&models.FormState{}, "user_email = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting form states: %w", err)
	}

	// Delete refresh tokens
	if err := tx.Delete(&models.RefreshToken{}, "user_email = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting refresh tokens: %w", err)
	}

	// Delete password reset tokens
	if err := tx.Delete(&models.PasswordResetToken{}, "user_email = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting password reset tokens: %w", err)
	}

	// Delete devices
	if err := tx.Delete(&models.Device{}, "user_email = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting devices: %w", err)
	}

	// Delete assessments
	if err := tx.Delete(&models.Assessment{}, "user_email = ?", email).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("error deleting assessments: %w", err)
	}

	// Finally, delete the user
	if err := tx.Delete(&models.User{}, "email = ?", email).Error; err != nil {
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

	var user models.User
	result := r.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.log.Errorw("Database error getting user by email", "email", email, "error", result.Error)
		return nil, result.Error
	}
	return &user, nil
}

// UserExists checks if a user with the given email exists
func (r *UserRepository) UserExists(email string) (bool, error) {
	var count int64
	result := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count)
	if result.Error != nil {
		r.log.Errorw("Database error checking user existence", "email", email, "error", result.Error)
		return false, result.Error
	}
	return count > 0, nil
}

// UpdatePassword updates a user's password
func (r *UserRepository) UpdatePassword(email string, hashedPassword []byte) error {
	result := r.db.Model(&models.User{}).
		Where("email = ?", email).
		Update("password", hashedPassword)
	if result.Error != nil {
		r.log.Errorw("Database error updating user password", "email", email, "error", result.Error)
		return result.Error
	}
	return nil
}

// Check if user has already completed assessment for today
func (r *UserRepository) HasCompletedAssessment(userEmail string) (bool, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour) // Start of today

	err := r.db.Model(&models.User{}).
		Where("email = ? AND last_assessment_date >= ?", userEmail, today).
		Count(&count).Error

	return count > 0, err
}

// SavePushSubscription saves a push subscription for a user
func (r *UserRepository) SavePushSubscription(userEmail string, subscription string) error {
	// Update user record with push subscription
	var user models.User
	if err := r.db.Where("email = ?", userEmail).First(&user).Error; err != nil {
		return err
	}

	// Update user model to include push_subscription field
	if err := r.db.Model(&user).Update("push_subscription", subscription).Error; err != nil {
		return err
	}

	return nil
}

// SaveNotificationPreferences saves a user's complete notification preferences
func (r *UserRepository) SaveNotificationPreferences(userEmail string, preferences *UserNotificationPreferences) error {
	var user models.User
	if err := r.db.Where("email = ?", userEmail).First(&user).Error; err != nil {
		return err
	}

	// Convert preferences to JSON
	preferencesJSON, err := json.Marshal(preferences)
	if err != nil {
		return err
	}

	// Update user model
	if err := r.db.Model(&user).Update("push_preferences", preferencesJSON).Error; err != nil {
		return err
	}

	return nil
}

// GetPushSubscription gets a user's push subscription
func (r *UserRepository) GetPushSubscription(userEmail string) (string, error) {
	var user models.User
	if err := r.db.Where("email = ?", userEmail).First(&user).Error; err != nil {
		return "", err
	}

	return user.PushSubscription, nil
}

// GetPushPreferences gets a user's push notification preferences
func (r *UserRepository) GetNotificationPreferences(userEmail string) (*UserNotificationPreferences, error) {
	var user models.User
	if err := r.db.Where("email = ?", userEmail).First(&user).Error; err != nil {
		return nil, err
	}

	// Default preferences if none are set
	if user.PushPreferences == "" {
		return &UserNotificationPreferences{
			PushEnabled:   false,
			EmailEnabled:  false,
			ReminderTimes: []string{"20:00"},
			CutoffTime:    "10:00",
		}, nil
	}

	var preferences UserNotificationPreferences
	if err := json.Unmarshal([]byte(user.PushPreferences), &preferences); err != nil {
		return nil, err
	}

	return &preferences, nil
}

// SearchUsers searches for users by email or name
func (r *UserRepository) SearchUsers(query string, skip, limit int) (*[]models.User, int64, error) {
	var users []models.User
	var total int64

	if query != "" {
		query = "%" + query + "%"
		r.db = r.db.Where("email LIKE ? OR first_name LIKE ? OR last_name LIKE ?", query, query, query)
	}

	if err := r.db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	result := r.db.Order("email").Offset(skip).Limit(limit).Find(&users)
	if result.Error != nil {
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
