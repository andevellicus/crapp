// File: internal/handlers/metrics.go
package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/metrics"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// MetricsHandler handles interaction metrics processing
type MetricsHandler struct {
	log *zap.SugaredLogger
}

// NewMetricsHandler creates a new metrics handler
func NewMetricsHandler(log *zap.SugaredLogger) *MetricsHandler {
	return &MetricsHandler{
		log: log.Named("metrics"),
	}
}

// ProcessInteractionData processes raw interaction data and returns calculated metrics
func (h *MetricsHandler) ProcessInteractionData(c *gin.Context) {
	var data metrics.InteractionData

	if err := c.ShouldBindJSON(&data); err != nil {
		h.log.Errorw("Error parsing interaction data", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid data format"})
		return
	}

	// Process metrics
	calculator := metrics.NewMetricCalculator(data)
	calculatedMetrics := calculator.CalculateAllMetrics()

	// Return processed metrics
	c.JSON(http.StatusOK, calculatedMetrics)
}

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
