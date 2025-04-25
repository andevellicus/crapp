// File: internal/handlers/form.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
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

func NewFormHandler(repo *repository.Repository, log *zap.SugaredLogger, questionLoader *utils.QuestionLoader) *FormHandler {
	return &FormHandler{
		questionLoader: questionLoader,
		repo:           repo,
		log:            log.Named("form"),
		validator:      validation.NewFormValidator(questionLoader),
	}
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
		c.JSON(515, gin.H{"error": "Invalid form state"})
		return
	}

	// Get all questions
	questions := h.questionLoader.GetQuestions()

	// Check if we've shown all questions
	if formState.CurrentStep >= len(questionOrder) {
		// If all questions are answered, return submission screen info
		c.JSON(http.StatusOK, gin.H{
			"state":    "complete",
			"message":  "All questions answered",
			"question": questions[questionOrder[len(questionOrder)-1]],
			"answers":  formState.Answers,
		})
		return
	}

	// Get the current question index with bounds checking
	questionIndex := questionOrder[formState.CurrentStep]

	// Validate the question index
	if questionIndex < 0 || questionIndex >= len(questions) {
		h.log.Errorw("Invalid question index", //TODO Need to reset the form state here
			"questionIndex", questionIndex,
			"totalQuestions", len(questions))
		// Add a custom error code here to signal a form state reset:
		c.JSON(515, gin.H{"error": "Invalid question configuration"})
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
		compressed, err := utils.CompressData(req.InteractionData)
		if err != nil {
			h.log.Warnw("Failed to compress interaction data", "error", err)
			formState.InteractionData = req.InteractionData // Fallback to uncompressed
		} else {
			formState.InteractionData = compressed
		}
	}

	// If CPT data is provided, save it as raw data
	if len(req.CPTData) > 0 {
		compressed, err := utils.CompressData(req.CPTData)
		if err != nil {
			h.log.Warnw("Failed to compress CPT data", "error", err)
			formState.CPTData = req.CPTData // Fallback to uncompressed
		} else {
			formState.CPTData = compressed
		}
	}

	// If Trail Making Test data is provided, save it as raw data
	if len(req.TMTData) > 0 {
		compressed, err := utils.CompressData(req.TMTData)
		if err != nil {
			h.log.Warnw("Failed to compress CPT data", "error", err)
			formState.TMTData = req.TMTData // Fallback to uncompressed
		} else {
			formState.TMTData = compressed
		}
	}

	// If Trail Making Test data is provided, save it as raw data
	if len(req.DigitSpanData) > 0 {
		compressed, err := utils.CompressData(req.DigitSpanData)
		if err != nil {
			h.log.Warnw("Failed to compress digit span data", "error", err)
			formState.DigitSpanData = req.DigitSpanData // Fallback to uncompressed
		} else {
			formState.DigitSpanData = compressed
		}
	}

	// Parse the question order from JSON string
	var questionOrder []int
	if err := json.Unmarshal([]byte(formState.QuestionOrder), &questionOrder); err != nil {
		h.log.Errorw("Error parsing question order", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Invalid form state"})
		return
	}

	// Update step based on direction
	if direction == "next" && formState.CurrentStep < len(questionOrder) {
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

	var req validation.SubmitFormRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.log.Warnw("Invalid submit request body", "error", err, "stateId", stateId)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		return
	}
	// Basic validation (might add more specific checks)
	validPermissions := map[string]bool{"prompt": true, "granted": true, "denied": true, "unavailable": true}
	if _, ok := validPermissions[req.LocationPermission]; !ok {
		req.LocationPermission = "unknown" // Default or handle error
		h.log.Warnw("Invalid location_permission value received", "value", req.LocationPermission)
	}
	if req.LocationPermission == "granted" && (req.Latitude == nil || req.Longitude == nil) {
		h.log.Warnw("Location permission granted but coordinates missing", "stateId", stateId)
		// Decide how to handle: maybe set permission to 'error' or proceed?
		// For now, we proceed but log the warning.
	}

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

	// Get device ID
	deviceID := getDeviceID(c)
	if deviceID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Device ID required"})
		return
	}

	// Use a transaction for the entire submission process
	var assessmentID uint
	err = h.repo.WithTransaction(func(tx *gorm.DB) error {
		// Use sql.NullFloat64 and sql.NullString for nullable fields
		var lat sql.NullFloat64
		var lon sql.NullFloat64
		var locErr sql.NullString

		if req.Latitude != nil {
			lat = sql.NullFloat64{Float64: *req.Latitude, Valid: true}
		}
		if req.Longitude != nil {
			lon = sql.NullFloat64{Float64: *req.Longitude, Valid: true}
		}
		if req.LocationError != nil {
			locErr = sql.NullString{String: *req.LocationError, Valid: true}
		}

		// Create assessment using direct SQL for better performance
		if err := tx.Raw(`
            INSERT INTO assessments (user_email, device_id, submitted_at, location_permission, latitude, longitude, location_error)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            RETURNING id
            `, userEmail.(string), deviceID, time.Now(), req.LocationPermission, lat, lon, locErr).
			Scan(&assessmentID).Error; err != nil {
			return err
		}

		// Process interaction data if available
		if len(formState.InteractionData) > 0 {
			err := h.processInteractionData(assessmentID, formState.InteractionData, tx)
			if err != nil {
				h.log.Warnw("Error processing interaction data", "error", err)
				return err
			}
		}

		// Process CPT data if available
		if len(formState.CPTData) > 0 {
			err := h.processCPTData(assessmentID, userEmail.(string), deviceID, formState.CPTData, tx)
			if err != nil {
				h.log.Warnw("Error processing CPT data", "error", err)
				return err
			}
		}

		// Process Trail Making Test data if available
		if len(formState.TMTData) > 0 {
			err := h.processTMTData(assessmentID, userEmail.(string), deviceID, formState.TMTData, tx)
			if err != nil {
				h.log.Warnw("Error processing TMT data", "error", err)
				return err
			}
		}

		if len(formState.DigitSpanData) > 0 {
			err := h.processDigitSpanData(assessmentID, userEmail.(string), deviceID, formState.DigitSpanData, tx)
			if err != nil {
				h.log.Warnw("Error processing Digit Span data", "error", err)
				return err
			}
		}

		// Process form answers and save as question responses
		questionResponses, err := h.processFormAnswers(formState, assessmentID)
		if err != nil {
			h.log.Errorw("Error processing form answers", "error", err)
			return err
		}

		if len(questionResponses) > 0 {
			// Use batch insert with VALUES clause for better performance
			valueStrings := make([]string, 0, len(questionResponses))
			valueArgs := make([]any, 0, len(questionResponses)*6)

			for i, response := range questionResponses {
				valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d)",
					i*6+1, i*6+2, i*6+3, i*6+4, i*6+5, i*6+6))

				valueArgs = append(valueArgs,
					response.AssessmentID,
					response.QuestionID,
					response.ValueType,
					response.NumericValue,
					response.TextValue,
					response.CreatedAt)
			}

			stmt := fmt.Sprintf("INSERT INTO question_responses (assessment_id, question_id, value_type, numeric_value, text_value, created_at) VALUES %s",
				strings.Join(valueStrings, ","))

			if err := tx.Exec(stmt, valueArgs...).Error; err != nil {
				h.log.Errorw("Failed to execute batch insert", "error", err)
				return err
			}
		}

		// Mark form state as completed
		formState.AssessmentID = &assessmentID
		if err := tx.Model(&models.FormState{}).
			Where("id = ?", formState.ID).
			Update("assessment_id", &assessmentID).Error; err != nil {
			return err
		}

		// Set last assessment completed time to now
		if err := tx.Model(&models.User{}).
			Where("LOWER(email) = ?", userEmail.(string)).
			Update("last_assessment_date", time.Now()).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		h.log.Errorw("Error submitting form", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Error processing form submission"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"assessment_id": assessmentID,
	})
}

func (h *FormHandler) processInteractionData(assessmentID uint, data []byte, tx *gorm.DB) error {
	// Decompress the interaction data first
	decompressedData, err := utils.DecompressData(data)
	if err != nil {
		h.log.Warnw("Error decompressing interaction data", "error", err)
		// Try to continue with potentially compressed data
		decompressedData = data
	}

	var interactionData metrics.InteractionData
	if err := json.Unmarshal(decompressedData, &interactionData); err != nil {
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

		// Bulk insert metrics with PostgreSQL-optimized COPY approach
		if len(allMetrics) > 0 {
			metricsTable := "assessment_metrics"
			columns := []string{"assessment_id", "question_id", "metric_key", "metric_value", "sample_size", "created_at"}

			// Create value sets for bulk insert
			valueStrings := make([]string, 0, len(allMetrics))
			valueArgs := make([]interface{}, 0, len(allMetrics)*len(columns))

			for i, metric := range allMetrics {
				valueStrings = append(valueStrings, fmt.Sprintf("($%d, $%d, $%d, $%d, $%d, $%d)",
					i*6+1, i*6+2, i*6+3, i*6+4, i*6+5, i*6+6))

				valueArgs = append(valueArgs, metric.AssessmentID)
				valueArgs = append(valueArgs, metric.QuestionID)
				valueArgs = append(valueArgs, metric.MetricKey)
				valueArgs = append(valueArgs, metric.MetricValue)
				valueArgs = append(valueArgs, metric.SampleSize)
				valueArgs = append(valueArgs, time.Now())
			}

			stmt := fmt.Sprintf("INSERT INTO %s (%s) VALUES %s",
				metricsTable,
				strings.Join(columns, ", "),
				strings.Join(valueStrings, ", "))

			if err := tx.Exec(stmt, valueArgs...).Error; err != nil {
				h.log.Warnw("Error saving metrics", "error", err)
				return err
			}
		}
	}

	return nil
}

func (h *FormHandler) processCPTData(assessmentID uint, userEmail, deviceID string, data []byte, tx *gorm.DB) error {
	// Decompress the CPT data first
	decompressedData, err := utils.DecompressData(data)
	if err != nil {
		h.log.Warnw("Error decompressing CPT data", "error", err)
		// Try to continue with potentially compressed data
		decompressedData = data
	}

	var cptData metrics.CPTData
	if err := json.Unmarshal(decompressedData, &cptData); err != nil {
		h.log.Warnw("Error parsing CPT data", "error", err)
	} else {
		// If these aren't set, then we haven't perfomed the test
		if cptData.TestStartTime == 0.0 && cptData.TestEndTime == 0.0 {
			h.log.Info("CPT data missing start or end time, skipping processing")
			return nil

		}
		cptResults := metrics.CalculateCPTMetrics(&cptData)

		// Set assessment ID and user info
		cptResults.UserEmail = userEmail
		cptResults.DeviceID = deviceID
		cptResults.AssessmentID = assessmentID

		// Save CPT results using direct SQL for better performance
		if err := tx.Exec(`
                        INSERT INTO cpt_results (
                            user_email, device_id, assessment_id, 
                            test_start_time, test_end_time,
                            correct_detections, commission_errors, omission_errors,
                            average_reaction_time, reaction_time_sd,
                            detection_rate, omission_error_rate, commission_error_rate,
                            raw_data, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			cptResults.UserEmail, cptResults.DeviceID, cptResults.AssessmentID,
			cptResults.TestStartTime, cptResults.TestEndTime,
			cptResults.CorrectDetections, cptResults.CommissionErrors, cptResults.OmissionErrors,
			cptResults.AverageReactionTime, cptResults.ReactionTimeSD,
			cptResults.DetectionRate, cptResults.OmissionErrorRate, cptResults.CommissionErrorRate,
			cptResults.RawData, time.Now()).Error; err != nil {
			h.log.Warnw("Error saving CPT results", "error", err)
			return err

		}
	}
	return nil
}

func (h *FormHandler) processTMTData(assessmentID uint, userEmail, deviceID string, data []byte, tx *gorm.DB) error {
	// Decompress the TMT data first
	decompressedData, err := utils.DecompressData(data)
	if err != nil {
		h.log.Warnw("Error decompressing TMT data", "error", err)
		// Try to continue with potentially compressed data
		decompressedData = data
	}

	var trailData metrics.TrailMakingData
	if err := json.Unmarshal(decompressedData, &trailData); err != nil {
		h.log.Warnw("Error parsing Trail Making Test data", "error", err)
	} else {
		// If these aren't set, then we haven't performed the test
		if trailData.TestStartTime == 0.0 && trailData.TestEndTime == 0.0 {
			h.log.Info("Trail Making Test data missing start or end time, skipping processing")
			return nil
		}

		tmtResults := metrics.CalculateTrailMetrics(&trailData)

		// Set assessment ID and user info
		tmtResults.UserEmail = userEmail
		tmtResults.DeviceID = deviceID
		tmtResults.AssessmentID = assessmentID

		// Save TMT results using direct SQL for better performance
		if err := tx.Exec(`
                INSERT INTO tmt_results (
                    user_email, device_id, assessment_id, 
                    test_start_time, test_end_time,
                    part_a_completion_time, part_a_errors,
                    part_b_completion_time, part_b_errors,
                    b_to_a_ratio, raw_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			tmtResults.UserEmail, tmtResults.DeviceID, tmtResults.AssessmentID,
			tmtResults.TestStartTime, tmtResults.TestEndTime,
			tmtResults.PartACompletionTime, tmtResults.PartAErrors,
			tmtResults.PartBCompletionTime, tmtResults.PartBErrors,
			tmtResults.BToARatio, tmtResults.RawData, time.Now()).Error; err != nil {
			h.log.Warnw("Error saving TMT results", "error", err)
			return err

		}
	}
	return nil
}

func (h *FormHandler) processDigitSpanData(assessmentID uint, userEmail, deviceID string, data []byte, tx *gorm.DB) error {
	decompressedData, err := utils.DecompressData(data)
	if err != nil {
		h.log.Warnw("Failed to decompress Digit Span data, proceeding with raw bytes", "error", err, "assessment_id", assessmentID)
		decompressedData = data
	}

	// Unmarshal into temporary struct to calculate metrics
	var rawDigitSpanData metrics.DigitSpanRawData
	if err := json.Unmarshal(decompressedData, &rawDigitSpanData); err != nil {
		h.log.Warnw("Error unmarshalling Digit Span raw data", "error", err, "assessment_id", assessmentID)
	} else {
		if rawDigitSpanData.TestStartTime == 0.0 && rawDigitSpanData.TestEndTime == 0.0 {
			h.log.Info("Digit Span data missing start or end time, skipping processing")
			return nil
		}

		digitSpanResult, err := metrics.CalculateDigitSpanMetrics(&rawDigitSpanData)
		if err != nil {
			h.log.Errorw("Error calculating Digit Span metrics", "error", err, "assessment_id", assessmentID)
			return fmt.Errorf("failed to calculate digit span metrics: %w", err)
		}
		digitSpanResult.UserEmail = userEmail
		digitSpanResult.DeviceID = deviceID
		digitSpanResult.AssessmentID = assessmentID
		digitSpanResult.RawData = decompressedData // Save the raw data
		digitSpanResult.CreatedAt = time.Now()

		// --- Save using the transaction ---
		if err := tx.Create(&digitSpanResult).Error; err != nil {
			h.log.Errorw("Error saving Digit Span result", "error", err, "assessment_id", assessmentID)
			return fmt.Errorf("failed to save digit span result: %w", err)
		}
		h.log.Infow("Successfully saved Digit Span result", "result_id", digitSpanResult.ID, "assessment_id", assessmentID)
	}

	return nil
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

	// Iterate through all answers
	for questionID, answerValue := range formState.Answers {
		// Get question definition to help determine expected answer type
		question, questionExists := questionMap[questionID]
		if !questionExists {
			h.log.Warnw("Skipping answer for unknown question ID", "question_id", questionID)
			continue
		}

		// Check if it's a dropdown and apply default if answer is missing/nil
		// Use the isEmptyAnswer helper from internal/validation/form_validation.go
		if question.Type == "dropdown" && validation.IsEmptyAnswer(answerValue) { // Make sure validation helper is accessible or reimplement check
			if question.Default != "" {
				// Try to find the option value corresponding to the default string
				for _, opt := range question.Options {
					var optionStr string
					switch v := opt.Value.(type) { // Convert option value to string for comparison
					case string:
						optionStr = v
					case float64:
						optionStr = fmt.Sprintf("%g", v)
					case int:
						optionStr = fmt.Sprintf("%d", v)
					default:
						optionStr = fmt.Sprintf("%v", opt.Value)
					}

					if question.Default == optionStr {
						answerValue = opt.Value // Use the actual option value
						break
					}
				}
			}
		}

		// Skip null or nil values
		if answerValue == nil {
			continue
		}

		// Skip questions with complex object answers (like CPT tests)
		switch answerValue.(type) {
		case map[string]any, []interface{}:
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
