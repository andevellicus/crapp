package handlers

import (
	"net/http"

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
