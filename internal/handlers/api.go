package handlers

import (
	"net/http"
	"strconv"

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
