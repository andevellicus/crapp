package handlers

import (
	"net/http"
	"strconv"

	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// GinAPIHandler handles API endpoints with Gin
type GinAPIHandler struct {
	repo           *repository.Repository
	questionLoader *utils.QuestionLoader
	log            *zap.SugaredLogger
}

// NewAPIHandler creates a new API handler for Gin
func NewAPIHandler(repo *repository.Repository, log *zap.SugaredLogger, questionLoader *utils.QuestionLoader) *GinAPIHandler {
	return &GinAPIHandler{
		repo:           repo,
		questionLoader: questionLoader,
		log:            log.Named("api"),
	}
}

// GetQuestions returns all questions
func (h *GinAPIHandler) GetQuestions(c *gin.Context) {
	questions := h.questionLoader.GetQuestions()
	c.JSON(http.StatusOK, questions)
}

// GetSymptomQuestions returns only the symptom questions (radio type)
func (h *GinAPIHandler) GetSymptomQuestions(c *gin.Context) {
	questions := h.questionLoader.GetRadioQuestions()
	c.JSON(http.StatusOK, questions)
}

// SubmitAssessment handles assessment submissions
func (h *GinAPIHandler) SubmitAssessment(c *gin.Context) {
	var submission models.AssessmentSubmission

	// Parse the request body
	if err := c.ShouldBindJSON(&submission); err != nil {
		h.log.Errorw("Error decoding submission", "error", err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request payload"})
		return
	}

	// Log submission
	h.log.Infow("Received assessment submission", "user_id", submission.UserEmail)

	// Save to database
	assessmentID, err := h.repo.CreateAssessment(&submission)
	if err != nil {
		h.log.Errorw("Error processing submission", "error", err, "user_id", submission.UserEmail)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing assessment submission"})
		return
	}

	// Return success response
	c.JSON(http.StatusOK, models.SubmissionResponse{
		Status:       "success",
		AssessmentID: assessmentID,
	})
}

// GetUserAssessments returns assessments for a user
func (h *GinAPIHandler) GetUserAssessments(c *gin.Context) {
	userID := c.Query("user_id")

	// Get the current user from context (set by auth middleware)
	currentUserEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check if user is trying to access someone else's data
	isAdmin, _ := c.Get("isAdmin")
	if userID != currentUserEmail.(string) && (!isAdmin.(bool)) {
		// Non-admin trying to access other user's data
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required to view other users' data"})
		return
	}

	// Get query parameters for pagination
	skip := 0
	limit := 100

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

	// Get assessments from database
	assessments, err := h.repo.GetAssessmentsByUser(userID, skip, limit)
	if err != nil {
		h.log.Errorw("Error retrieving assessments", "error", err, "user_id", userID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error retrieving assessments"})
		return
	}

	c.JSON(http.StatusOK, assessments)
}

// SearchUsers handles admin search for users
func (h *GinAPIHandler) SearchUsers(c *gin.Context) {
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

	users, total, err := h.repo.SearchUsers(query, skip, limit)
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
