package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// UserRepository extends the generic repository with user-specific methods
type UserRepository struct {
	Base *BaseRepository[models.User]
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
		Base: NewBaseRepository[models.User](db, log.Named("user"), "users"),
	}
}

// GetByEmail retrieves a user by email
func (r *UserRepository) GetUser(email string) (*models.User, error) {
	var user models.User
	result := r.Base.DB.Where("email = ?", email).First(&user)
	if result.Error != nil {
		if result.Error == gorm.ErrRecordNotFound {
			return nil, nil
		}
		r.Base.Log.Errorw("Failed to get user by email", "email", email, "error", result.Error)
		return nil, result.Error
	}
	return &user, nil
}

// UserExists checks if a user with the given email exists
func (r *UserRepository) UserExists(email string) (bool, error) {
	var count int64
	result := r.Base.DB.Model(&models.User{}).Where("email = ?", email).Count(&count)
	if result.Error != nil {
		r.Base.Log.Errorw("Failed to check user existence", "email", email, "error", result.Error)
		return false, result.Error
	}
	return count > 0, nil
}

// UpdateUserPassword updates a user's password
func (r *UserRepository) UpdateUserPassword(email string, hashedPassword []byte) error {
	result := r.Base.DB.Model(&models.User{}).
		Where("email = ?", email).
		Update("password", hashedPassword)
	if result.Error != nil {
		r.Base.Log.Errorw("Failed to update user password", "email", email, "error", result.Error)
		return result.Error
	}
	return nil
}

// Check if user has already completed assessment for today
func (r *UserRepository) HasCompletedAssessment(userEmail string) (bool, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour) // Start of today

	err := r.Base.DB.Model(&models.Assessment{}).
		Where("user_email = ? AND date >= ?", userEmail, today).
		Count(&count).Error

	return count > 0, err
}

// SearchUsers searches for users by email or name
func (r *UserRepository) SearchUsers(query string, skip, limit int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	if query != "" {
		query = "%" + query + "%"
		r.Base.DB = r.Base.DB.Where("email LIKE ? OR first_name LIKE ? OR last_name LIKE ?", query, query, query)
	}

	if err := r.Base.DB.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	result := r.Base.DB.Order("email").Offset(skip).Limit(limit).Find(&users)
	if result.Error != nil {
		return nil, 0, result.Error
	}

	// Don't return password hashes
	for i := range users {
		users[i].Password = nil
	}

	return users, total, nil
}
