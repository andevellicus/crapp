// internal/handlers/push.go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/scheduler"
	"github.com/andevellicus/crapp/internal/services"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PushHandler handles push notification endpoints
type PushHandler struct {
	pushService *services.PushService
	repo        *repository.Repository
	log         *zap.SugaredLogger
	scheduler   *scheduler.ReminderScheduler
}

// NewPushHandler creates a new push notification handler
func NewPushHandler(repo *repository.Repository, log *zap.SugaredLogger, pushService *services.PushService, scheduler *scheduler.ReminderScheduler) *PushHandler {
	return &PushHandler{
		pushService: pushService,
		repo:        repo,
		log:         log.Named("push"),
		scheduler:   scheduler,
	}
}

// GetVAPIDPublicKey returns the VAPID public key for subscription
func (h *PushHandler) GetVAPIDPublicKey(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"publicKey": h.pushService.GetVAPIDPublicKey(),
	})
}

// SubscribeUser subscribes a user to push notifications
func (h *PushHandler) SubscribeUser(c *gin.Context) {
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get validated subscription data
	sub := c.MustGet("validatedRequest").(*validation.PushSubscriptionRequest)

	// Convert to JSON string
	subscriptionBytes, err := json.Marshal(sub)
	if err != nil {
		h.log.Errorw("Failed to marshal subscription", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process subscription"})
		return
	}

	// Save subscription
	if err := h.pushService.SaveSubscription(userEmail.(string), string(subscriptionBytes)); err != nil {
		h.log.Errorw("Failed to save subscription", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save subscription"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// UpdatePreferences updates a user's notification preferences
func (h *PushHandler) UpdatePreferences(c *gin.Context) {
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get validated preferences
	prefs := c.MustGet("validatedRequest").(*validation.NotificationPreferencesRequest)

	// Convert to repository model
	preferences := repository.UserNotificationPreferences{
		PushEnabled:   prefs.PushEnabled,
		EmailEnabled:  prefs.EmailEnabled,
		ReminderTimes: prefs.ReminderTimes,
	}

	// Save preferences
	if err := h.repo.Users.SaveNotificationPreferences(userEmail.(string), &preferences); err != nil {
		h.log.Errorw("Failed to save preferences", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preferences"})
		return
	}

	// Update schedules if needed
	if h.scheduler != nil {
		if err := h.scheduler.UpdateSchedules(); err != nil {
			h.log.Warnw("Failed to update reminder schedules", "error", err)
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GetPreferences gets a user's push notification preferences
func (h *PushHandler) GetPreferences(c *gin.Context) {
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get preferences using the new method
	preferences, err := h.repo.Users.GetNotificationPreferences(userEmail.(string))
	if err != nil {
		h.log.Errorw("Failed to get preferences", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"push_enabled":   preferences.PushEnabled,
		"email_enabled":  preferences.EmailEnabled,
		"reminder_times": preferences.ReminderTimes,
	})
}
