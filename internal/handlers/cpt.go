// internal/handlers/cpt.go
package handlers

import (
	"net/http"
	"strconv"

	"github.com/andevellicus/crapp/internal/repository"
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

/*
DEPRECATED?? //TODO
// SaveCPTResults handles saving CPT test results
func (h *CognitiveTestHandler) SaveCPTResults(c *gin.Context) {
	// Get user email from context (set by auth middleware)
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Parse request
	req := c.MustGet("validatedRequest").(*validation.CPTResultsRequest)

	// Ensure the results are for the authenticated user
	if req.UserEmail != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Cannot submit results for another user"})
		return
	}

	// Create results
	newResult := &models.CPTResult{
		UserEmail:           req.UserEmail,
		DeviceID:            req.DeviceID,
		AssessmentID:        req.AssessmentID,
		TestStartTime:       req.TestStartTime,
		TestEndTime:         req.TestEndTime,
		CorrectDetections:   req.CorrectDetections,
		CommissionErrors:    req.CommissionErrors,
		OmissionErrors:      req.OmissionErrors,
		AverageReactionTime: req.AverageReactionTime,
		ReactionTimeSD:      req.ReactionTimeSD,
		DetectionRate:       req.DetectionRate,
		OmissionErrorRate:   req.OmissionErrorRate,
		CommissionErrorRate: req.CommissionErrorRate,
		RawData:             req.RawData,
	}

	// Save CPT results
	resultID, err := h.repo.CPTResults.SaveCPTResults(newResult, req.AssessmentID)
	if err != nil {
		h.log.Errorw("Error saving CPT results", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save test results"})
		return
	}

	// Return success
	c.JSON(http.StatusOK, gin.H{
		"message":   "CPT results saved successfully",
		"result_id": resultID,
	})
}
*/

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
