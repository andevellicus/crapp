// internal/push/service.go
package services

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/andevellicus/crapp/internal/repository"
	"go.uber.org/zap"
)

// PushService handles push notifications
type PushService struct {
	repo         *repository.Repository
	log          *zap.SugaredLogger
	vapidPublic  string
	vapidPrivate string
}

// NewPushService creates a new push notification service
func NewPushService(repo *repository.Repository, log *zap.SugaredLogger, vapidPublic, vapidPrivate string) *PushService {
	return &PushService{
		repo:         repo,
		log:          log,
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
	return s.repo.Users.SavePushSubscription(userEmail, subscription)
}

// SendNotification sends a push notification to a user
func (s *PushService) SendNotification(email string, title, body string) error {
	normalizedEmail := strings.ToLower(email)
	// Get user's subscription
	sub, err := s.repo.Users.GetPushSubscription(normalizedEmail)
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
		// Check if user has already completed today's assessment
		completed, err := s.repo.Users.HasCompletedAssessment(user.Email)
		if err != nil {
			s.log.Warnw("Failed to check assessment completion status",
				"error", err, "user", user.Email)
			continue
		}

		// Skip push reminder if assessment is already completed
		if completed {
			s.log.Infow("Skipping push reminder - assessment already completed",
				"user", user.Email)
			continue
		}

		if err := s.SendNotification(user.Email,
			"Daily Symptom Report Reminder",
			"Don't forget to complete your symptom report for today!"); err != nil {
			log.Printf("Failed to send reminder to %s: %v", user.Email, err)
		}
	}

	return nil
}
