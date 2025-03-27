// File: internal/handlers/metrics.go
package handlers

import (
	"net/http"

	"github.com/andevellicus/crapp/internal/metrics"
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
