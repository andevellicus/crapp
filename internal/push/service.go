// internal/push/service.go
package push

import (
	"encoding/json"
	"fmt"
	"log"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/andevellicus/crapp/internal/repository"
)

// PushService handles push notifications
type PushService struct {
	repo         *repository.Repository
	vapidPublic  string
	vapidPrivate string
}

// NewPushService creates a new push notification service
func NewPushService(repo *repository.Repository, vapidPublic, vapidPrivate string) *PushService {
	return &PushService{
		repo:         repo,
		vapidPublic:  vapidPublic,
		vapidPrivate: vapidPrivate,
	}
}

// GetVAPIDPublicKey returns the public VAPID key for subscriptions
func (s *PushService) GetVAPIDPublicKey() string {
	return s.vapidPublic
}

// SaveSubscription saves a user's push subscription
func (s *PushService) SaveSubscription(userEmail string, subscription string) error {
	return s.repo.SavePushSubscription(userEmail, subscription)
}

// SendNotification sends a push notification to a user
func (s *PushService) SendNotification(userEmail string, title, body string) error {
	// Get user's subscription
	sub, err := s.repo.GetPushSubscription(userEmail)
	if err != nil {
		return err
	}

	if sub == "" {
		return fmt.Errorf("user has no push subscription")
	}

	// Parse subscription
	var subscription webpush.Subscription
	if err := json.Unmarshal([]byte(sub), &subscription); err != nil {
		return err
	}

	// Create notification payload
	message := map[string]any{
		"title": title,
		"body":  body,
		"icon":  "/static/icons/icon-192x192.png",
		"badge": "/static/icons/badge-96x96.png",
		"data": map[string]string{
			"url": "/",
		},
	}

	// Convert to JSON
	messageBytes, err := json.Marshal(message)
	if err != nil {
		return err
	}

	// Send notification
	resp, err := webpush.SendNotification(messageBytes, &subscription, &webpush.Options{
		Subscriber:      "example@example.com", // Your contact info
		VAPIDPublicKey:  s.vapidPublic,
		VAPIDPrivateKey: s.vapidPrivate,
		TTL:             30,
	})
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

// SendReminderToAllEligibleUsers sends reminder notifications to all users based on their preferences
func (s *PushService) SendReminderToAllEligibleUsers(reminderTime string) error {
	// Get all users with enabled reminders for this time
	users, err := s.repo.GetUsersForReminder(reminderTime)
	if err != nil {
		return err
	}

	for _, user := range users {
		if err := s.SendNotification(user.Email,
			"Daily Symptom Report Reminder",
			"Don't forget to complete your symptom report for today!"); err != nil {
			log.Printf("Failed to send reminder to %s: %v", user.Email, err)
		}
	}

	return nil
}
