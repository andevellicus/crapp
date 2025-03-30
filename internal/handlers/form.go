// File: internal/handlers/form.go
package handlers

import (
	"encoding/json"
	"math/rand"
	"net/http"

	"github.com/andevellicus/crapp/internal/metrics"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"github.com/microcosm-cc/bluemonday"
	"go.uber.org/zap"
)

type FormHandler struct {
	questionLoader *utils.QuestionLoader
	repo           *repository.Repository
	log            *zap.SugaredLogger
	validator      *validation.FormValidator
}

func NewFormHandler(repo *repository.Repository, log *zap.SugaredLogger, questionLoader *utils.QuestionLoader) *FormHandler {
	return &FormHandler{
		questionLoader: questionLoader,
		repo:           repo,
		log:            log.Named("form"),
		validator:      validation.NewFormValidator(questionLoader),
	}
}

func (h *FormHandler) ServeForm(c *gin.Context) {
	// Get all questions
	questions := h.questionLoader.GetQuestions()

	// Randomize question order
	randomizedQuestions := make([]utils.Question, len(questions))
	copy(randomizedQuestions, questions)
	rand.Shuffle(len(randomizedQuestions), func(i, j int) {
		randomizedQuestions[i], randomizedQuestions[j] = randomizedQuestions[j], randomizedQuestions[i]
	})

	// Render the template with the questions
	c.HTML(http.StatusOK, "form.html", gin.H{
		"title":     "Daily Symptom Report",
		"questions": randomizedQuestions,
	})
}

// InitForm initializes a new form session
func (h *FormHandler) InitForm(c *gin.Context) {
	// Get user from context
	userEmail, exists := c.Get("userEmail")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	// Check if user has an active form state
	existingState, err := h.repo.GetUserActiveFormState(userEmail.(string))
	if err == nil && existingState != nil {
		// Return existing form state
		c.JSON(http.StatusOK, existingState)
		return
	}

	// Get all questions
	questions := h.questionLoader.GetQuestions()

	// Create randomized question order
	questionOrder := make([]int, len(questions))
	for i := range questionOrder {
		questionOrder[i] = i
	}
	rand.Shuffle(len(questionOrder), func(i, j int) {
		questionOrder[i], questionOrder[j] = questionOrder[j], questionOrder[i]
	})

	// Create new form state
	formState, err := h.repo.CreateFormState(userEmail.(string), questionOrder)
	if err != nil {
		h.log.Errorw("Error creating form state", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error initializing form"})
		return
	}

	c.JSON(http.StatusOK, formState)
}

// GetCurrentQuestion gets the current question for a form state
func (h *FormHandler) GetCurrentQuestion(c *gin.Context) {
	stateID := c.Param("stateId")

	// Get form state
	formState, err := h.repo.GetFormState(stateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form state not found"})
		return
	}

	// Verify user owns this form state
	userEmail, _ := c.Get("userEmail")
	if formState.UserEmail != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Parse the question order from JSON string
	var questionOrder []int
	if err := json.Unmarshal([]byte(formState.QuestionOrder), &questionOrder); err != nil {
		h.log.Errorw("Error parsing question order", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid form state"})
		return
	}

	// Get all questions
	questions := h.questionLoader.GetQuestions()

	// Check if we've shown all questions
	if formState.CurrentStep >= len(questionOrder) {
		// If all questions are answered, return submission screen info
		c.JSON(http.StatusOK, gin.H{
			"state":   "complete",
			"message": "All questions answered",
			"answers": formState.Answers,
		})
		return
	}

	// Get the current question index with bounds checking
	questionIndex := questionOrder[formState.CurrentStep]

	// Validate the question index
	if questionIndex < 0 || questionIndex >= len(questions) {
		h.log.Errorw("Invalid question index",
			"questionIndex", questionIndex,
			"totalQuestions", len(questions))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid question configuration"})
		return
	}

	// Get the question
	question := questions[questionIndex]

	// Get previous answer if available
	var previousAnswer interface{}
	if val, ok := formState.Answers[question.ID]; ok {
		previousAnswer = val
	}

	c.JSON(http.StatusOK, gin.H{
		"state":           "question",
		"current_step":    formState.CurrentStep + 1,
		"total_steps":     len(questionOrder),
		"question":        question,
		"previous_answer": previousAnswer,
	})
}

// SaveAnswer saves the answer to a question and advances to next step
func (h *FormHandler) SaveAnswer(c *gin.Context) {
	stateID := c.Param("stateId")

	// Get form state
	formState, err := h.repo.GetFormState(stateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form state not found"})
		return
	}

	// Verify user owns this form state
	userEmail, _ := c.Get("userEmail")
	if formState.UserEmail != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Parse request body
	var saveRequest struct {
		QuestionID string      `json:"question_id"`
		Answer     interface{} `json:"answer"`
		Direction  string      `json:"direction"` // "next" or "prev"
	}

	if err := c.ShouldBindJSON(&saveRequest); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
		return
	}

	// Sanitize text inputs
	if answer, ok := saveRequest.Answer.(string); ok {
		saveRequest.Answer = sanitizeHTML(answer)
	}

	// Validate answer (only if going forward)
	if saveRequest.Direction == "next" {
		errors := h.validator.ValidateAnswer(saveRequest.QuestionID, saveRequest.Answer)
		if len(errors) > 0 {
			c.JSON(http.StatusBadRequest, validation.ValidationResponse{
				Valid:   false,
				Errors:  errors,
				Message: "Validation failed",
				Field:   saveRequest.QuestionID,
			})
			return
		}
	}

	// Save the answer
	formState.Answers[saveRequest.QuestionID] = saveRequest.Answer

	// Update step based on direction
	if saveRequest.Direction == "next" {
		formState.CurrentStep++
	} else if saveRequest.Direction == "prev" && formState.CurrentStep > 0 {
		formState.CurrentStep--
	}

	// Save form state
	if err := h.repo.UpdateFormState(formState); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving answer"})
		return
	}

	// Return the updated form state
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"next_step": formState.CurrentStep,
	})
}

// SubmitForm submits the completed form
func (h *FormHandler) SubmitForm(c *gin.Context) {
	stateID := c.Param("stateId")

	// Get form state
	formState, err := h.repo.GetFormState(stateID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Form state not found"})
		return
	}

	// Verify user owns this form state
	userEmail, _ := c.Get("userEmail")
	if formState.UserEmail != userEmail.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Parse question order
	var questionOrder []int
	if err := json.Unmarshal([]byte(formState.QuestionOrder), &questionOrder); err != nil {
		h.log.Errorw("Error parsing question order", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid form state"})
		return
	}

	// Validate all answers
	validationResult := h.validator.ValidateForm(formState.Answers)
	if !validationResult.Valid {
		c.JSON(http.StatusBadRequest, validationResult)
		return
	}

	// Process any metrics data
	var metricsData struct {
		InteractionData metrics.InteractionData `json:"interaction_data"`
	}

	if err := c.ShouldBindJSON(&metricsData); err == nil {
		// Process metrics data if available
		calculator := metrics.NewMetricCalculator(metricsData.InteractionData)
		calculatedMetrics := calculator.CalculateAllMetrics()

		// Create proper metadata structure
		metadata := map[string]any{
			"interaction_metrics": calculatedMetrics,
			"question_metrics":    calculatedMetrics["questionMetrics"],
			"question_order":      questionOrder,
		}

		// Marshal to JSON properly
		metadataBytes, err := json.Marshal(metadata)
		if err != nil {
			h.log.Errorw("Error marshaling metadata", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing form data"})
			return
		}

		// Create submission with metrics
		submission := &models.AssessmentSubmission{
			UserEmail: userEmail.(string),
			DeviceID:  c.GetHeader("X-Device-ID"), // Assume device ID is in header
			Responses: formState.Answers,
			Metadata:  json.RawMessage(metadataBytes),
		}

		// Save assessment
		assessmentID, err := h.repo.CreateAssessment(submission)
		if err != nil {
			h.log.Errorw("Error saving assessment", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving assessment"})
			return
		}

		// Mark form state as completed
		formState.Completed = true
		h.repo.UpdateFormState(formState)

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"assessment_id": assessmentID,
		})
	} else {
		h.log.Infow("No interaction data in request", "error", err)

		// Just create submission without metrics
		submission := &models.AssessmentSubmission{
			UserEmail: userEmail.(string),
			DeviceID:  c.GetHeader("X-Device-ID"),
			Responses: formState.Answers,
		}

		// Save assessment
		assessmentID, err := h.repo.CreateAssessment(submission)
		if err != nil {
			h.log.Errorw("Error saving assessment", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving assessment"})
			return
		}

		// Mark form state as completed
		formState.Completed = true
		h.repo.UpdateFormState(formState)

		c.JSON(http.StatusOK, gin.H{
			"success":       true,
			"assessment_id": assessmentID,
		})
	}
}

func sanitizeHTML(input string) string {
	// Use bluemonday for HTML sanitization
	p := bluemonday.UGCPolicy()
	return p.Sanitize(input)
}
