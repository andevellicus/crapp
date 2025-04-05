// File: internal/handlers/form.go
package handlers

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"time"

	"github.com/andevellicus/crapp/internal/metrics"
	"github.com/andevellicus/crapp/internal/models"
	"github.com/andevellicus/crapp/internal/repository"
	"github.com/andevellicus/crapp/internal/utils"
	"github.com/andevellicus/crapp/internal/validation"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
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
	if err == nil && existingState != nil {
		// Return existing form state
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

	// Get validated interaction data
	req := c.MustGet("validatedRequest").(*validation.SubmitFormRequest)

	// Process metrics data
	calculator := metrics.NewMetricCalculator(req.InteractionData, req.CPTData)
	calculatedMetrics := calculator.CalculateMetrics()

	// Save assessment
	assessmentID, err := h.repo.Assessments.Create(userEmail.(string), c.GetHeader("X-Device-ID"))
	if err != nil {
		h.log.Errorw("Error saving assessment", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error saving assessment"})
		return
	}

	// TODO Should save metric data here

	// Process cognitive test results if present
	if len(req.CognitiveTests) > 0 {
		h.processCognitiveTestResults(c, req.CognitiveTests, userEmail.(string), c.GetHeader("X-Device-ID"), assessmentID)
	}

	// Mark form state as completed
	formState.Completed = true
	h.repo.FormStates.Update(formState)

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"assessment_id": assessmentID,
	})
}

// processCognitiveTestResults handles saving cognitive test results
func (h *FormHandler) processCognitiveTestResults(c *gin.Context, tests []models.CognitiveTestResult, userEmail, deviceID string, assessmentID uint) {

	for _, test := range tests {
		question := h.questionLoader.GetQuestionByID(test.QuestionID)
		if question != nil && question.MetricsType != "" {
			switch question.MetricsType {
			case "cpt":
				// Parse CPT data
				var cptData map[string]interface{}
				if err := json.Unmarshal(test.Results, &cptData); err != nil {
					h.log.Warnw("Error parsing CPT data", "error", err)
					continue
				}

				// Create CPT result model
				cptResult := &models.CPTResult{
					UserEmail:    userEmail,
					DeviceID:     deviceID,
					AssessmentID: assessmentID,
					RawData:      test.Results,
					CreatedAt:    time.Now(),
					TestType:     models.CPTest,
				}

				// TODO -- maybe we can clean this up somehow
				// Extract key metrics
				if startTime, ok := cptData["testStartTime"].(float64); ok {
					cptResult.TestStartTime = time.Unix(0, int64(startTime)*int64(time.Millisecond))
				}

				if endTime, ok := cptData["testEndTime"].(float64); ok {
					cptResult.TestEndTime = time.Unix(0, int64(endTime)*int64(time.Millisecond))
				}

				if correctDetections, ok := cptData["correctDetections"].(float64); ok {
					cptResult.CorrectDetections = int(correctDetections)
				}

				if commissionErrors, ok := cptData["commissionErrors"].(float64); ok {
					cptResult.CommissionErrors = int(commissionErrors)
				}

				if omissionErrors, ok := cptData["omissionErrors"].(float64); ok {
					cptResult.OmissionErrors = int(omissionErrors)
				}

				if avgReactionTime, ok := cptData["averageReactionTime"].(float64); ok {
					cptResult.AverageReactionTime = avgReactionTime
				}

				if reactionTimeSD, ok := cptData["reactionTimeSD"].(float64); ok {
					cptResult.ReactionTimeSD = reactionTimeSD
				}

				if detectionRate, ok := cptData["detectionRate"].(float64); ok {
					cptResult.DetectionRate = detectionRate
				}

				if omissionErrorRate, ok := cptData["omissionErrorRate"].(float64); ok {
					cptResult.OmissionErrorRate = omissionErrorRate
				}

				if commissionErrorRate, ok := cptData["commissionErrorRate"].(float64); ok {
					cptResult.CommissionErrorRate = commissionErrorRate
				}

				// Save CPT result
				if _, err := h.repo.CPTResults.SaveCPTResults(cptResult, assessmentID); err != nil {
					h.log.Warnw("Error saving CPT result", "error", err)
					return
				}
				return
			case "trail_making":
				// Similar processing for trail making test
				h.log.Infow("Trail making test result processing not implemented yet")
				return
			default:
				h.log.Warnw("Unknown metrics type", "metrics_type", question.MetricsType)
				return
			}
		}

		// We shouldn't get here, so there's some error if we have:
		h.log.Errorw("Error in processing cognitive test results",
			"assessment_id", assessmentID,
			"question_id", test.QuestionID)

		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing cognitive test results"})
		return
	}

}
