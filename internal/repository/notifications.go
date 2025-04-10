package repository

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

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
		preferences, err := r.Users.GetNotificationPreferences(user.Email)
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
	if err := r.db.Where("notification_preferences IS NOT NULL").Find(&users).Error; err != nil {
		return nil, err
	}

	// Collect all unique times
	timeMap := make(map[string]bool)

	for _, user := range users {
		preferences, err := r.Users.GetNotificationPreferences(user.Email)
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
		preferences, err := r.Users.GetNotificationPreferences(user.Email)
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
