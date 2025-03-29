// internal/scheduler/scheduler.go
package scheduler

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/push"
	"github.com/andevellicus/crapp/internal/repository"
)

// ReminderScheduler handles scheduling of reminders
type ReminderScheduler struct {
	pushService *push.PushService
	config      *config.Config
	repo        *repository.Repository
	jobs        map[string]*time.Timer
	mutex       sync.Mutex
}

// NewReminderScheduler creates a new reminder scheduler
func NewReminderScheduler(repo *repository.Repository, config *config.Config, pushService *push.PushService) *ReminderScheduler {
	return &ReminderScheduler{
		pushService: pushService,
		repo:        repo,
		config:      config,
		jobs:        make(map[string]*time.Timer),
		mutex:       sync.Mutex{},
	}
}

// Start initializes and starts the scheduler
func (s *ReminderScheduler) Start() error {
	// Get reminder configuration
	for i, timeStr := range s.config.Reminders.Times {
		if err := s.scheduleReminderDaily(timeStr, i); err != nil {
			return fmt.Errorf("failed to schedule reminder for %s: %w", timeStr, err)
		}
	}

	log.Printf("Scheduled %d reminders", len(s.config.Reminders.Times))
	return nil
}

// scheduleReminderDaily schedules a daily reminder at the specified time
func (s *ReminderScheduler) scheduleReminderDaily(timeStr string, reminderIndex int) error {
	// Parse time
	t, err := time.Parse("15:04", timeStr)
	if err != nil {
		return fmt.Errorf("invalid time format: %w", err)
	}

	// Get current time
	now := time.Now()

	// Set reminder time for today
	reminderTime := time.Date(
		now.Year(), now.Month(), now.Day(),
		t.Hour(), t.Minute(), 0, 0,
		now.Location(),
	)

	// If the time has already passed today, schedule for tomorrow
	if reminderTime.Before(now) {
		reminderTime = reminderTime.Add(24 * time.Hour)
	}

	// Calculate duration until reminder
	duration := reminderTime.Sub(now)

	// Create a unique key for this reminder
	key := fmt.Sprintf("reminder_%s", timeStr)

	// Lock mutex to prevent race conditions
	s.mutex.Lock()
	defer s.mutex.Unlock()

	// Cancel existing timer if any
	if timer, exists := s.jobs[key]; exists {
		timer.Stop()
	}

	// Create new timer
	timer := time.AfterFunc(duration, func() {
		// Send reminder using the time string instead of index
		if err := s.pushService.SendReminderToAllEligibleUsers(timeStr); err != nil {
			log.Printf("Error sending reminder: %v", err)
		}

		// Reschedule for tomorrow
		if err := s.scheduleReminderDaily(timeStr, reminderIndex); err != nil {
			log.Printf("Error rescheduling reminder: %v", err)
		}
	})

	// Store timer
	s.jobs[key] = timer

	log.Printf("Scheduled reminder for %s (in %v)", timeStr, duration)
	return nil
}

// Stop stops all scheduled reminders
func (s *ReminderScheduler) Stop() {
	s.mutex.Lock()
	defer s.mutex.Unlock()

	for key, timer := range s.jobs {
		timer.Stop()
		delete(s.jobs, key)
	}

	log.Println("Stopped all reminders")
}
