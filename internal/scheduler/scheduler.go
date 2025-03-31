// internal/scheduler/scheduler.go
package scheduler

import (
	"fmt"
	"sync"
	"time"

	"github.com/andevellicus/crapp/internal/config"
	"github.com/andevellicus/crapp/internal/email"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/push"
	"github.com/andevellicus/crapp/internal/repository"
	"go.uber.org/zap"
)

// ReminderScheduler handles scheduling of reminders
type ReminderScheduler struct {
	pushService  *push.PushService
	emailService *email.EmailService
	config       *config.Config
	repo         *repository.Repository
	log          *zap.SugaredLogger
	jobs         map[string]*time.Timer
	mutex        sync.Mutex
}

// NewReminderScheduler creates a new reminder scheduler
func NewReminderScheduler(repo *repository.Repository,
	log *zap.SugaredLogger,
	config *config.Config,
	pushService *push.PushService,
	emailService *email.EmailService) *ReminderScheduler {

	return &ReminderScheduler{
		pushService:  pushService,
		emailService: emailService,
		repo:         repo,
		log:          log.Named("sched"),
		config:       config,
		jobs:         make(map[string]*time.Timer),
		mutex:        sync.Mutex{},
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
		// Call sendReminders instead of directly using pushService
		if err := s.sendReminders(timeStr); err != nil {
			s.log.Errorw("Error sending reminders", "error", err)
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

// sendReminders sends push and email reminders to eligible users
func (s *ReminderScheduler) sendReminders(timeStr string) error {
	// Send push notifications if service is available
	if s.pushService != nil {
		if err := s.pushService.SendReminderToAllEligibleUsers(timeStr); err != nil {
			s.log.Errorw("Error sending push reminders", "error", err, "time", timeStr)
			// Continue to email reminders even if push fails
		} else {
			s.log.Infow("Push reminders sent successfully", "time", timeStr)
		}
	}

	// Send email reminders if service is available
	if s.emailService != nil && s.config.Email.Enabled {
		// Get users who have enabled email reminders for this time
		users, err := s.repo.GetUsersForEmailReminder(timeStr)
		if err != nil {
			s.log.Errorw("Error getting users for email reminders", "error", err, "time", timeStr)
		} else if len(users) > 0 {
			s.log.Infow("Sending email reminders", "count", len(users), "time", timeStr)

			// Send email to each eligible user
			for _, user := range users {
				// Check if user has already completed today's assessment
				completed, err := s.repo.HasCompletedAssessment(user.Email)
				if err != nil {
					s.log.Warnw("Failed to check assessment completion status",
						"error", err, "user", user.Email)
					continue
				}

				// Skip reminder if assessment is already completed
				if completed {
					s.log.Infow("Skipping reminder - assessment already completed",
						"user", user.Email)
					continue
				}

				// Use goroutine to send emails asynchronously
				go func(u *models.User) {
					// Default to email as first name if first name is empty
					firstName := u.FirstName
					if firstName == "" {
						firstName = u.Email
					}

					if err := s.emailService.SendReminderEmail(u.Email, firstName); err != nil {
						s.log.Warnw("Failed to send reminder email",
							"error", err,
							"user", u.Email,
							"time", timeStr)
					} else {
						s.log.Infow("Sent reminder email",
							"user", u.Email,
							"time", timeStr)
					}
				}(user)
			}
		} else {
			s.log.Infow("No users eligible for email reminders at this time", "time", timeStr)
		}
	}

	return nil
}
