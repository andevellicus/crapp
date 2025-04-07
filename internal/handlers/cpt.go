// internal/handlers/cpt.go
package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/andevellicus/crapp/internal/metrics"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CognitiveTestHandler handles cognitive test endpoints
type CognitiveTestHandler struct {
	repo *repository.Repository
	log  *zap.SugaredLogger
}

// NewCognitiveTestHandler creates a new cognitive test handler
func NewCognitiveTestHandler(repo *repository.Repository, log *zap.SugaredLogger) *CognitiveTestHandler {
	return &CognitiveTestHandler{
		repo: repo,
		log:  log.Named("cognitive-tests"),
	}
}

// SaveCPTResults handles saving CPT test results
func (h *CognitiveTestHandler) SaveCPTResults(c *gin.Context) {
	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get validated request data
	req := c.MustGet("validatedRequest").(*validation.CPTResultsRequest)

	// Ensure the results are for the authenticated user
	if req.UserEmail != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot submit results for another user"})
		return
	}

	var cptData metrics.CPTData
	if err := json.Unmarshal(req.RawData, &cptData); err != nil {
		h.log.Warnw("Error parsing CPT raw data", "error", err)
	}

	// Process raw data to calculate metrics if necessary
	if req.RawData != nil {
		// Parse the raw data to CPTData format
		var cptData metrics.CPTData
		if err := json.Unmarshal(req.RawData, &cptData); err != nil {
			h.log.Warnw("Error parsing CPT raw data", "error", err)
		}

		// Validate minimum required data in CPTData
		if len(cptData.StimuliPresented) == 0 {
		}

		if cptData.TestStartTime <= 0 || cptData.TestEndTime <= 0 {
		}

		// Use MetricCalculator to calculate CPT metrics
		calculatedMetrics := metrics.CalculateCPTMetrics(&cptData)

		// Update the results with calculated metrics from the calculator
		if calculatedMetrics != nil {
			results := &models.CPTResult{
				UserEmail:           req.UserEmail,
				DeviceID:            req.DeviceID,
				AssessmentID:        req.AssessmentID,
				TestStartTime:       calculatedMetrics.TestStartTime,
				TestEndTime:         calculatedMetrics.TestEndTime,
				CorrectDetections:   calculatedMetrics.CorrectDetections,
				CommissionErrors:    calculatedMetrics.CommissionErrors,
				OmissionErrors:      calculatedMetrics.OmissionErrors,
				AverageReactionTime: calculatedMetrics.AverageReactionTime,
				ReactionTimeSD:      calculatedMetrics.ReactionTimeSD,
				DetectionRate:       calculatedMetrics.DetectionRate,
				OmissionErrorRate:   calculatedMetrics.OmissionErrorRate,
				CommissionErrorRate: calculatedMetrics.CommissionErrorRate,
				CreatedAt:           calculatedMetrics.CreatedAt,
				RawData:             req.RawData,
			}

			// Save to database
			if err := h.repo.CPTResults.Create(results); err != nil {
				h.log.Errorw("Error saving CPT result", "error", err)
			}

		} else {
			h.log.Warnw("No CPT result calculated", "user", req.UserEmail)
		}
	}

}

// GetCPTResults retrieves CPT results for a user
func (h *CognitiveTestHandler) GetCPTResults(c *gin.Context) {
	// Get user email from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Get user ID from query - admin only feature
	userID := c.Query("user_id")

	// Check access permissions
	isAdmin, _ := c.Get("isAdmin")
	if userID != "" && userID != userEmail.(string) && (!isAdmin.(bool)) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// If no user ID specified, use current user
	if userID == "" {
		userID = userEmail.(string)
	}

	// Get limit parameter (default to 10)
	limit := 10
	if limitParam := c.Query("limit"); limitParam != "" {
		if val, err := strconv.Atoi(limitParam); err == nil && val > 0 {
			limit = val
		}
	}

	// Get CPT results for user
	results, err := h.repo.CPTResults.GetCPTResults(userID, limit)
	if err != nil {
		h.log.Errorw("Error retrieving CPT results", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve test results"})
		return
	}

	c.JSON(http.StatusOK, results)
}
