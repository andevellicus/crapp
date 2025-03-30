// internal/scheduler/scheduler.go
package scheduler

import (
	"fmt"
	"sync"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/push"
	"github.com/andevellicus/crapp/internal/repository"
	"go.uber.org/zap"
)

// ReminderScheduler handles scheduling of reminders
type ReminderScheduler struct {
	pushService *push.PushService
	config      *config.Config
	repo        *repository.Repository
	log         *zap.SugaredLogger
	jobs        map[string]*time.Timer
	mutex       sync.Mutex
}

// NewReminderScheduler creates a new reminder scheduler
func NewReminderScheduler(repo *repository.Repository, log *zap.SugaredLogger, config *config.Config, pushService *push.PushService) *ReminderScheduler {
	return &ReminderScheduler{
		pushService: pushService,
		repo:        repo,
		log:         log.Named("sched"),
		config:      config,
		jobs:        make(map[string]*time.Timer),
		mutex:       sync.Mutex{},
	}
}

// Start initializes and starts the scheduler
func (s *ReminderScheduler) Start() error {
	// Get all unique user-defined reminder times
	userTimes, err := s.repo.GetAllUniqueReminderTimes()
	if err != nil {
		s.log.Errorw("Error getting user reminder times", "error", err)
		// Fall back to config times if there's an error
		userTimes = s.config.Reminders.Times
	}

	// Combine with default times from config
	allTimes := make(map[string]bool)

	// Add config times
	for _, timeStr := range s.config.Reminders.Times {
		allTimes[timeStr] = true
	}

	// Add user times
	for _, timeStr := range userTimes {
		allTimes[timeStr] = true
	}

	// Schedule all unique times
	timeIndex := 0
	for timeStr := range allTimes {
		if err := s.scheduleReminderDaily(timeStr, timeIndex); err != nil {
			return fmt.Errorf("failed to schedule reminder for %s: %w", timeStr, err)
		}
		timeIndex++
	}
	s.log.Infof("Scheduled %d reminders", len(allTimes))
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

	s.log.Info("Stopped all reminders")
}

// UpdateSchedules refreshes all scheduled reminders
func (s *ReminderScheduler) UpdateSchedules() error {
	// Stop all current jobs
	s.Stop()

	// Restart with fresh schedules
	return s.Start()
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
			s.log.Errorw("Error sending reminder", "error", err)
		}

		// Reschedule for tomorrow
		if err := s.scheduleReminderDaily(timeStr, reminderIndex); err != nil {
			s.log.Errorw("Error rescheduling reminder", "error", err)

		}
	})

	// Store timer
	s.jobs[key] = timer

	s.log.Infof("Scheduled reminder for %s (in %v)", timeStr, duration)
	return nil
}
