package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

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

	db := r.db

	if query != "" {
		query = "%" + query + "%"
		db = db.Where("email LIKE ? OR first_name LIKE ? OR last_name LIKE ?", query, query, query)
	}

	if err := db.Model(&models.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	result := db.Order("email").Offset(skip).Limit(limit).Find(&users)
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

// UpdateUserLogin updates a user's last login time
func (r *Repository) UpdateUserLogin(userID string) (*models.User, error) {
	var user models.User
	result := r.db.First(&user, "id = ?", userID)
	if result.Error != nil {
		return nil, result.Error
	}

	user.LastLogin = time.Now()
	result = r.db.Save(&user)
	if result.Error != nil {
		return nil, result.Error
	}

	return &user, nil
}
