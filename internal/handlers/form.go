// File: internal/handlers/form.go
package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"time"

	"github.com/andevellicus/crapp/internal/metrics"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type FormHandler struct {
	questionLoader *utils.QuestionLoader
	repo           *repository.Repository
	log            *zap.SugaredLogger
	validator      *validation.FormValidator
}

// CognitiveTestResult represents a cognitive test result within a form submission
type CognitiveTestResult struct {
	QuestionID string          `json:"question_id"`
	Results    json.RawMessage `json:"results"`
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
	c.HTML(http.StatusOK, "index.html", gin.H{
		"title":         "Daily Symptom Report",
		"questions":     randomizedQuestions,
		"usePostMethod": true,
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

	// Check if we should force a new form state
	var req struct {
		ForceNew bool `json:"force_new"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.ForceNew {
		// If force_new is true, don't check for existing state
		h.createNewFormState(c, userEmail.(string))
		return
	}

	// Check if user has an active form state
	existingState, err := h.repo.FormStates.GetUserActiveFormState(userEmail.(string))
	if err != nil {
		// Only create new state if error is NOT a "not found" error
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			h.log.Errorw("Database error getting form state", "error", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
			return
		}
		// If record not found, continue to create new state
		h.log.Infow("No active form state found, creating new one", "user", userEmail.(string))
	} else if existingState != nil {
		// Return existing form state
		h.log.Infow("Using existing form state", "user", userEmail.(string), "stateId", existingState.ID)
		c.JSON(http.StatusOK, existingState)
		return
	}

	// Create new form state
	h.createNewFormState(c, userEmail.(string))
}

// Helper function to create a new form state
func (h *FormHandler) createNewFormState(c *gin.Context, userEmail string) {
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
	formState, err := h.repo.FormStates.Create(userEmail, questionOrder)
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
	formState, err := h.repo.FormStates.GetByID(stateID)
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
	var previousAnswer any
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

	// Get validated request data
	req := c.MustGet("validatedRequest").(*validation.SaveAnswerRequest)

	if answer, ok := req.Answer.(string); ok {
		req.Answer = utils.SanitizeHTML(answer)
	}

	// Get form state
	formState, err := h.repo.FormStates.GetByID(stateID)
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

	questionId := req.QuestionID
	answer := req.Answer
	direction := req.Direction

	// Save the answer to the form state
	formState.Answers[questionId] = answer

	// If interaction data is provided, save it as raw data
	if len(req.InteractionData) > 0 {
		formState.InteractionData = req.InteractionData
	}

	// If CPT data is provided, save it as raw data
	if len(req.CPTData) > 0 {
		formState.CPTData = req.CPTData
	}

	// Update step based on direction
	if direction == "next" {
		formState.CurrentStep++
	} else if direction == "prev" && formState.CurrentStep > 0 {
		formState.CurrentStep--
	}

	// Save form state
	if err := h.repo.FormStates.Update(formState); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving answer"})
		return
	}

	// Return the updated form state
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"next_step": formState.CurrentStep,
	})
}

// SubmitForm handles form submission with validated data
func (h *FormHandler) SubmitForm(c *gin.Context) {
	stateId := c.Param("stateId")

	// Get form state
	formState, err := h.repo.FormStates.GetByID(stateId)
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

	// Create assessment
	assessmentID, err := h.repo.Assessments.Create(userEmail.(string), c.GetHeader("X-Device-ID"))
	if err != nil {
		h.log.Errorw("Error creating assessment", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving assessment"})
		return
	}

	// Process interaction data if available
	if len(formState.InteractionData) > 0 {
		var interactionData metrics.InteractionData
		if err := json.Unmarshal(formState.InteractionData, &interactionData); err != nil {
			h.log.Warnw("Error parsing interaction data", "error", err)
		} else {
			// Calculate metrics from the raw data
			calculatedMetrics := metrics.CalculateInteractionMetrics(&interactionData)

			// Set assessment ID for all metrics
			for i := range calculatedMetrics.GlobalMetrics {
				calculatedMetrics.GlobalMetrics[i].AssessmentID = assessmentID
			}
			for i := range calculatedMetrics.QuestionMetrics {
				calculatedMetrics.QuestionMetrics[i].AssessmentID = assessmentID
			}

			// Combine all metrics for efficient batch insert
			allMetrics := append(calculatedMetrics.GlobalMetrics, calculatedMetrics.QuestionMetrics...)
			// Save metrics in a single batch operation
			if len(allMetrics) > 0 {
				if err := h.repo.CreateInBatches(allMetrics, 100); err != nil {
					h.log.Warnw("Error saving metrics", "error", err)
				} else {
					h.log.Infow("Saved metrics successfully", "count", len(allMetrics))
				}
			}
		}
	}

	// Process CPT data if available
	if len(formState.CPTData) > 0 {
		var cptData metrics.CPTData
		if err := json.Unmarshal(formState.CPTData, &cptData); err != nil {
			h.log.Warnw("Error parsing CPT data", "error", err)
		} else {
			// If these aren't set, then we haven't perfomed the test
			if cptData.TestStartTime == 0.0 && cptData.TestEndTime == 0.0 {
				h.log.Info("CPT data missing start or end time, skipping processing")
			} else {
				cptResults := metrics.CalculateCPTMetrics(&cptData)

				// Set assessment ID and user info
				cptResults.UserEmail = userEmail.(string)
				cptResults.DeviceID = c.GetHeader("X-Device-ID")
				cptResults.AssessmentID = assessmentID

				// Save CPT results
				if err := h.repo.CPTResults.Create(cptResults); err != nil {
					h.log.Warnw("Error saving CPT results", "error", err)
				} else {
					h.log.Infow("Saved CPT results successfully", "assessment_id", assessmentID)
				}
			}
		}
	}

	// Process form answers and save as question responses
	questionResponses, err := h.processFormAnswers(formState, assessmentID)
	if err != nil {
		h.log.Errorw("Error processing form answers", "error", err)
		// Continue with other processing - don't fail the entire submission
	} else if len(questionResponses) > 0 {
		// Save question responses
		if err := h.repo.QuestionResponses.SaveBatch(questionResponses); err != nil {
			h.log.Errorw("Error saving question responses", "error", err)
		} else {
			h.log.Infow("Saved question responses successfully", "count", len(questionResponses))
		}
	}

	// Mark form state as completed
	formState.Completed = true
	h.repo.FormStates.Update(formState)

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"assessment_id": assessmentID,
	})
}

// ProcessFormAnswers converts formState.Answers map to a slice of QuestionResponse structs
func (h *FormHandler) processFormAnswers(formState *models.FormState, assessmentID uint) ([]models.QuestionResponse, error) {
	// Get question definitions to help determine value types
	allQuestions := h.questionLoader.GetQuestions()
	questionMap := make(map[string]utils.Question)
	for _, q := range allQuestions {
		questionMap[q.ID] = q
	}

	var responses []models.QuestionResponse
	now := time.Now()

	// Log number of answers being processed
	h.log.Infow("Processing form answers",
		"assessment_id", assessmentID,
		"answer_count", len(formState.Answers),
		"user_email", formState.UserEmail)

	// Iterate through all answers
	for questionID, answerValue := range formState.Answers {
		// Skip null or nil values
		if answerValue == nil {
			continue
		}

		// Skip questions with complex object answers (like CPT tests)
		switch answerValue.(type) {
		case map[string]interface{}, []interface{}:
			// This is likely a complex object (CPT test result, etc.)
			h.log.Debugw("Skipping complex answer object",
				"question_id", questionID,
				"value_type", fmt.Sprintf("%T", answerValue))
			continue
		}

		// Create a new response
		response := models.QuestionResponse{
			AssessmentID: assessmentID,
			QuestionID:   questionID,
			CreatedAt:    now,
		}

		// Get question definition to help determine expected answer type
		question, questionExists := questionMap[questionID]

		// Determine value type and set appropriate field
		switch value := answerValue.(type) {
		case float64:
			// Handle float values (common from JSON)
			response.ValueType = "number"
			response.NumericValue = value

		case int:
			// Handle integer values
			response.ValueType = "number"
			response.NumericValue = float64(value)

		case string:
			// For string values, check if it should be a number
			if questionExists && (question.Type == "radio" || question.Type == "dropdown") {
				// Try to convert to float if this is a radio or dropdown
				if numValue, err := strconv.ParseFloat(value, 64); err == nil {
					response.ValueType = "number"
					response.NumericValue = numValue
				} else {
					// If conversion fails, store as string
					response.ValueType = "string"
					response.TextValue = value
				}
			} else {
				// Regular string answer
				response.ValueType = "string"
				response.TextValue = value
			}

		case bool:
			// Convert boolean to numeric (1.0 or 0.0)
			response.ValueType = "boolean"
			if value {
				response.NumericValue = 1.0
			} else {
				response.NumericValue = 0.0
			}

		default:
			// For other types, convert to string via JSON marshaling
			h.log.Warnw("Converting unexpected answer type to string",
				"question_id", questionID,
				"type", fmt.Sprintf("%T", value))

			if bytes, err := json.Marshal(value); err == nil {
				response.ValueType = "string"
				response.TextValue = string(bytes)
			} else {
				// Skip if we can't convert
				h.log.Errorw("Failed to convert answer to string",
					"question_id", questionID,
					"error", err)
				continue
			}
		}

		responses = append(responses, response)
	}

	h.log.Infow("Processed form answers",
		"assessment_id", assessmentID,
		"processed_count", len(responses))

	return responses, nil
}
