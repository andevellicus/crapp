package repository

import (
	"encoding/json"
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

// SavePushSubscription saves a push subscription for a user
func (r *Repository) SavePushSubscription(userEmail string, subscription string) error {
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
func (r *Repository) SaveNotificationPreferences(userEmail string, preferences *UserNotificationPreferences) error {
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
func (r *Repository) GetPushSubscription(userEmail string) (string, error) {
	var user models.User
	if err := r.db.Where("email = ?", userEmail).First(&user).Error; err != nil {
		return "", err
	}

	return user.PushSubscription, nil
}

// GetPushPreferences gets a user's push notification preferences
func (r *Repository) GetNotificationPreferences(userEmail string) (*UserNotificationPreferences, error) {
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

// GetUsersForReminder gets all users who should receive a reminder at the given index
func (r *Repository) GetUsersForReminder(reminderTime string) ([]models.User, error) {
	var users []models.User

	// Find users with push subscriptions
	if err := r.db.Where("push_subscription IS NOT NULL AND push_subscription != ''").Find(&users).Error; err != nil {
		return nil, err
	}

	// Filter users by their preferences
	var eligibleUsers []models.User
	for _, user := range users {
		preferences, err := r.GetNotificationPreferences(user.Email)
		if err != nil {
			r.log.Warnw("Failed to get push preferences", "user", user.Email, "error", err)
			continue
		}

		// Only include users who have enabled notifications
		if !preferences.PushEnabled && !preferences.EmailEnabled {
			continue
		}

		// Check if this time matches any of their preferred times
		for _, prefTime := range preferences.ReminderTimes {
			// Format both times to HH:MM for comparison
			if formatTime(prefTime) == formatTime(reminderTime) {
				eligibleUsers = append(eligibleUsers, user)
				break
			}
		}
	}

	return eligibleUsers, nil
}

func (r *Repository) GetAllUniqueReminderTimes() ([]string, error) {
	var users []models.User

	// Find users with push subscriptions
	if err := r.db.Where("push_subscription IS NOT NULL AND push_subscription != ''").Find(&users).Error; err != nil {
		return nil, err
	}

	// Collect all unique times
	timeMap := make(map[string]bool)

	for _, user := range users {
		preferences, err := r.GetNotificationPreferences(user.Email)
		if err != nil {
			continue
		}

		if preferences.PushEnabled || preferences.EmailEnabled {
			for _, timeStr := range preferences.ReminderTimes {
				// Normalize time format
				formattedTime := formatTime(timeStr)
				timeMap[formattedTime] = true
			}
		}
	}

	// Convert map to slice
	var times []string
	for timeStr := range timeMap {
		times = append(times, timeStr)
	}

	return times, nil
}

// Add a new function to get users for email reminders
func (r *Repository) GetUsersForEmailReminder(reminderTime string) ([]*models.User, error) {
	var users []*models.User

	// Get all users
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}

	// Filter users based on their email preferences
	var eligibleUsers []*models.User
	for _, user := range users {
		preferences, err := r.GetNotificationPreferences(user.Email)
		if err != nil {
			r.log.Warnw("Failed to get preferences", "user", user.Email, "error", err)
			continue
		}

		// Check if email reminders are enabled
		if preferences.EmailEnabled {
			// Check if this time matches any of their preferred times
			for _, prefTime := range preferences.ReminderTimes {
				if formatTime(prefTime) == formatTime(reminderTime) {
					eligibleUsers = append(eligibleUsers, user)
					break
				}
			}
		}
	}

	return eligibleUsers, nil
}

// Helper function to normalize time format
func formatTime(timeStr string) string {
	// Parse the time string to a time.Time
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		// Try alternate format
		t, err = time.Parse("3:04 PM", timeStr)
		if err != nil {
			return timeStr // Return as-is if parsing fails
		}
	}

	// Return in 24-hour format
	return t.Format("15:04")
}
