// internal/handlers/admin.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/services"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// AdminHandler handles administrative endpoints
type AdminHandler struct {
	repo         *repository.Repository
	log          *zap.SugaredLogger
	pushService  *services.PushService
	emailService *services.EmailService
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(
	repo *repository.Repository,
	log *zap.SugaredLogger,
	pushService *services.PushService,
	emailService *services.EmailService,
) *AdminHandler {
	return &AdminHandler{
		repo:         repo,
		log:          log.Named("admin"),
		pushService:  pushService,
		emailService: emailService,
	}
}

// SendReminder sends a reminder to a user via email or push notification
func (h *AdminHandler) SendReminder(c *gin.Context) {
	// Verify admin access (middleware should already handle this)
	isAdmin, exists := c.Get("isAdmin")
	if !exists || !isAdmin.(bool) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	req := c.MustGet("validatedRequest").(*validation.AdminReminderRequest)

	// Get user
	user, err := h.repo.Users.GetByEmail(req.Email)
	if err != nil {
		h.log.Errorw("Error getting user for reminder", "error", err, "email", req.Email)
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Get notification preferences
	prefs, err := h.repo.Users.GetNotificationPreferences(req.Email)
	if err != nil {
		h.log.Warnw("Error getting notification preferences", "error", err, "email", req.Email)
		// Continue anyway since this is an admin-initiated reminder
	}

	var success bool
	var errorMsg string

	// Send reminder based on method
	switch req.Method {
	case "email":
		// Send email reminder
		if h.emailService != nil {
			err = h.emailService.SendReminderEmail(user.Email, user.FirstName)
			if err != nil {
				h.log.Warnw("Failed to send email reminder", "error", err, "email", req.Email)
				errorMsg = "Failed to send email reminder: " + err.Error()
			} else {
				success = true
				h.log.Infow("Sent admin-initiated email reminder", "email", req.Email)
			}
		} else {
			errorMsg = "Email service not available"
		}

	case "push":
		// Send push notification
		if h.pushService == nil {
			errorMsg = "Push notification service not available"
			break
		} else if prefs.PushEnabled {
			err = h.pushService.SendNotification(
				user.Email,
				"Daily Assessment Reminder",
				"This is a reminder to complete your daily symptom assessment.",
			)
			if err != nil {
				h.log.Errorw("Failed to send push reminder", "error", err, "email", req.Email)
				errorMsg = "Failed to send push reminder: " + err.Error()
			} else {
				success = true
				h.log.Infow("Sent admin-initiated push reminder", "email", req.Email)
			}
		} else {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"error":   "User has disabled push notifications",
			})
			return
		}

	default:
		errorMsg = "Invalid reminder method"
	}

	// Return response
	if success {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Reminder sent successfully",
		})
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   errorMsg,
		})
	}
}

// SearchUsers handles admin search for users
func (h *AdminHandler) SearchUsers(c *gin.Context) {
	query := c.Query("q")
	skip := 0
	limit := 20

	if skipParam := c.Query("skip"); skipParam != "" {
		if val, err := strconv.Atoi(skipParam); err == nil && val >= 0 {
			skip = val
		}
	}

	if limitParam := c.Query("limit"); limitParam != "" {
		if val, err := strconv.Atoi(limitParam); err == nil && val > 0 {
			limit = val
		}
	}

	users, total, err := h.repo.Users.SearchUsers(query, skip, limit)
	if err != nil {
		h.log.Errorw("Error searching users", "error", err, "query", query)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error searching users"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": users,
		"total": total,
		"skip":  skip,
		"limit": limit,
	})
}
