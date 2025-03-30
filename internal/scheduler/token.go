// internal/scheduler/token_cleanup.go
package scheduler

import (
	"time"

	"github.com/andevellicus/crapp/internal/repository"
	"go.uber.org/zap"
)

// TokenCleanupScheduler periodically cleans up expired tokens
type TokenCleanupScheduler struct {
	repo     *repository.Repository
	log      *zap.SugaredLogger
	interval time.Duration
	stopChan chan struct{}
}

// NewTokenCleanupScheduler creates a new token cleanup scheduler
func NewTokenCleanupScheduler(repo *repository.Repository, log *zap.SugaredLogger) *TokenCleanupScheduler {
	return &TokenCleanupScheduler{
		repo:     repo,
		log:      log.Named("token-cleanup"),
		interval: 12 * time.Hour, // Run cleanup every 12 hours
		stopChan: make(chan struct{}),
	}
}

// Start begins the token cleanup scheduler
func (s *TokenCleanupScheduler) Start() {
	go func() {
		ticker := time.NewTicker(s.interval)
		defer ticker.Stop()

		// Run cleanup immediately on start
		s.cleanup()

		for {
			select {
			case <-ticker.C:
				s.cleanup()
			case <-s.stopChan:
				return
			}
		}
	}()

	s.log.Info("Token cleanup scheduler started")
}

// Stop stops the token cleanup scheduler
func (s *TokenCleanupScheduler) Stop() {
	close(s.stopChan)
	s.log.Info("Token cleanup scheduler stopped")
}

// cleanup performs the token cleanup task
func (s *TokenCleanupScheduler) cleanup() {
	s.log.Debug("Running token cleanup task")

	err := s.repo.CleanupExpiredTokens()
	if err != nil {
		s.log.Errorw("Failed to clean up expired tokens", "error", err)
		return
	}

	s.log.Debug("Token cleanup task completed successfully")
}
