// File: internal/handlers/metrics.go
package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/repository"
	"github.com/gin-gonic/gin"
)

// GetMetricsTimeline gets timeline visualization data
func (h *GinAPIHandler) GetMetricsTimeline(c *gin.Context) {
	userID := c.Query("user_id")
	symptomKey := c.Query("symptom")
	metricKey := c.Query("metric")

	// Get the current user from context (set by auth middleware)
	currentUserEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check if user is trying to access someone else's data
	isAdmin, _ := c.Get("isAdmin")
	if userID != currentUserEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// Get data from repository
	data, err := h.repo.GetMetricsTimeline(userID, symptomKey, metricKey)
	if err != nil {
		h.log.Errorw("Error retrieving metrics timeline", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving data"})
		return
	}

	// Return empty array instead of null if no data
	if data == nil {
		data = []repository.TimelineDataPoint{}
	}

	c.JSON(http.StatusOK, data)
}

// GetMetricsCorrelation gets correlation visualization data
func (h *GinAPIHandler) GetMetricsCorrelation(c *gin.Context) {
	userID := c.Query("user_id")
	symptomKey := c.Query("symptom")
	metricKey := c.Query("metric")

	// Auth checks (same as above)
	currentUserEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check if user is trying to access someone else's data
	isAdmin, _ := c.Get("isAdmin")
	if userID != currentUserEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// Get data from repository
	data, err := h.repo.GetMetricsCorrelation(userID, symptomKey, metricKey)
	if err != nil {
		h.log.Errorw("Error retrieving metrics correlation", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving data"})
		return
	}

	// Return empty array instead of null if no data
	if data == nil {
		data = []repository.CorrelationDataPoint{}
	}

	c.JSON(http.StatusOK, data)
}
