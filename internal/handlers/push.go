// internal/handlers/push.go
package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/andevellicus/crapp/internal/push"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/scheduler"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// PushHandler handles push notification endpoints
type PushHandler struct {
	pushService *push.PushService
	repo        *repository.Repository
	log         *zap.SugaredLogger
	scheduler   *scheduler.ReminderScheduler
}

// NewPushHandler creates a new push notification handler
func NewPushHandler(repo *repository.Repository, log *zap.SugaredLogger, pushService *push.PushService, scheduler *scheduler.ReminderScheduler) *PushHandler {
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

	// Get subscription from request body
	var subscription map[string]interface{}
	if err := c.ShouldBindJSON(&subscription); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid subscription data"})
		return
	}

	// Convert to JSON string
	subscriptionBytes, err := json.Marshal(subscription)
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

// UpdatePreferences updates a user's push notification preferences
func (h *PushHandler) UpdatePreferences(c *gin.Context) {
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get preferences from request body
	var preferences repository.UserPushPreferences
	if err := c.ShouldBindJSON(&preferences); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid preference data"})
		return
	}

	// Save preferences
	if err := h.repo.SavePushPreferences(userEmail.(string), &preferences); err != nil {
		h.log.Errorw("Failed to save preferences", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save preferences"})
		return
	}

	if h.scheduler != nil {
		if err := h.scheduler.UpdateSchedules(); err != nil {
			h.log.Warnw("Failed to update reminder schedules", "error", err)
			// Don't return error to client, just log it
		} else {
			h.log.Infow("Reminder schedules updated successfully")
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

	// Get preferences
	preferences, err := h.repo.GetPushPreferences(userEmail.(string))
	if err != nil {
		h.log.Errorw("Failed to get preferences", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get preferences"})
		return
	}

	c.JSON(http.StatusOK, preferences)
}
