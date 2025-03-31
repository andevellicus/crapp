package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

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

// CreateUser creates a new user
func (r *Repository) CreateUser(user *models.User) error {
	result := r.db.Create(user)
	return result.Error
}

// GetUser retrieves a user by email
func (r *Repository) GetUser(email string) (*models.User, error) {
	var user models.User
	result := r.db.Where("email = ?", email).First(&user)
	if result.Error != nil {
		return nil, result.Error
	}

	return &user, nil
}

// SearchUsers searches for users by email or name
func (r *Repository) SearchUsers(query string, skip, limit int) ([]models.User, int64, error) {
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

	return users, total, nil
}

// UserExists checks if a user with the given email exists
func (r *Repository) UserExists(email string) (bool, error) {
	var count int64
	result := r.db.Model(&models.User{}).Where("email = ?", email).Count(&count)
	return count > 0, result.Error
}

// UpdateUser updates an existing user
func (r *Repository) UpdateUser(user *models.User) error {
	result := r.db.Save(user)
	return result.Error
}

// UpdateUserPassword updates a user's password
func (r *Repository) UpdateUserPassword(email string, hashedPassword []byte) error {
	return r.db.Model(&models.User{}).
		Where("email = ?", email).
		Update("password", hashedPassword).Error
}

// Check if user has already completed assessment for today
func (r *Repository) HasCompletedAssessment(userEmail string) (bool, error) {
	var count int64
	today := time.Now().Truncate(24 * time.Hour) // Start of today

	err := r.db.Model(&models.Assessment{}).
		Where("user_email = ? AND date >= ?", userEmail, today).
		Count(&count).Error

	return count > 0, err
}
