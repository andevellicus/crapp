package repository

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

// CreateAssessment creates a new assessment with structured data
func (r *Repository) CreateAssessment(assessment *models.AssessmentSubmission) (uint, error) {
	log := r.log.With(
		"operation", "CreateAssessment",
		"userEmail", assessment.UserEmail,
		"deviceID", assessment.DeviceID,
	)

	// Check if user exists
	exists, err := r.UserExists(assessment.UserEmail)
	if err != nil || !exists {
		log.Errorw("Failed to check user existence", "error", err)
		return 0, fmt.Errorf("error checking user: %w", err)
	}

	// Check if device exists and belongs to user
	var device models.Device
	result := r.db.Where("id = ? AND user_email = ?", assessment.DeviceID, assessment.UserEmail).First(&device)
	if result.Error != nil {
		log.Errorw("Failed to device", "error", err)
		return 0, fmt.Errorf("device not found or doesn't belong to user: %w", result.Error)
	}

	// Update device last active time
	device.LastActive = time.Now()
	r.db.Save(&device)

	// Create assessment record - JSON fields stay for reference but aren't used for visualization
	newAssessment := models.Assessment{
		UserEmail:   assessment.UserEmail,
		DeviceID:    assessment.DeviceID,
		Date:        time.Now(),
		SubmittedAt: time.Now(),
		Responses:   assessment.Responses, // Keep JSON copy for reference
	}

	// Save to database
	result = r.db.Create(&newAssessment)
	if result.Error != nil {
		return 0, result.Error
	}

	// Now save structured responses
	if err := r.saveStructuredResponses(newAssessment.ID, assessment.Responses); err != nil {
		r.log.Warnw("Error saving structured responses", "error", err)
		// Don't fail the entire operation
	}

	// Save structured metrics if metadata available
	if assessment.Metadata != nil {
		if err := r.extractAndSaveMetrics(newAssessment.ID, assessment.Metadata); err != nil {
			r.log.Warnw("Error saving structured metrics", "error", err)
			// Don't fail the entire operation
		}
	}

	return newAssessment.ID, nil
}

// GetAssessment retrieves an assessment by ID
func (r *Repository) GetAssessment(assessmentID uint) (*models.Assessment, error) {
	var assessment models.Assessment
	result := r.db.First(&assessment, assessmentID)
	if result.Error != nil {
		return nil, result.Error
	}
	return &assessment, nil
}

// Save structured responses
func (r *Repository) saveStructuredResponses(assessmentID uint, responses models.JSON) error {
	questionResponses := make([]models.QuestionResponse, 0, len(responses))

	for questionID, value := range responses {
		response := models.QuestionResponse{
			AssessmentID: assessmentID,
			QuestionID:   questionID,
			CreatedAt:    time.Now(),
		}

		// Handle different value types
		switch v := value.(type) {
		case float64:
			response.ValueType = "number"
			response.NumericValue = v
		case int:
			response.ValueType = "number"
			response.NumericValue = float64(v)
		case string:
			response.ValueType = "string"
			response.TextValue = v
			// Try to convert to number if possible
			if f, err := strconv.ParseFloat(v, 64); err == nil {
				response.NumericValue = f
			}
		case bool:
			response.ValueType = "boolean"
			if v {
				response.NumericValue = 1.0
			} else {
				response.NumericValue = 0.0
			}
			response.TextValue = strconv.FormatBool(v)
		default:
			// For complex types, store as JSON
			response.ValueType = "object"
			if bytes, err := json.Marshal(v); err == nil {
				response.TextValue = string(bytes)
			}
		}

		questionResponses = append(questionResponses, response)
	}

	// Save all responses in a batch
	if len(questionResponses) > 0 {
		return r.db.CreateInBatches(questionResponses, 100).Error
	}

	return nil
}
