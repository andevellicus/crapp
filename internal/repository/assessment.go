package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

// CreateAssessment creates a new assessment from submission data
func (r *Repository) CreateAssessment(assessment *models.AssessmentSubmission) (uint, error) {
	// Check if user exists
	exists, err := r.UserExists(assessment.UserEmail)
	if err != nil {
		return 0, fmt.Errorf("error checking user: %w", err)
	}
	if !exists {
		return 0, fmt.Errorf("user not found: %s", assessment.UserEmail)
	}

	// Check if device exists and belongs to user
	var device models.Device
	result := r.db.Where("id = ? AND user_email = ?", assessment.DeviceID, assessment.UserEmail).First(&device)
	if result.Error != nil {
		return 0, fmt.Errorf("device not found or doesn't belong to user: %w", result.Error)
	}

	// Update device last active time
	device.LastActive = time.Now()
	r.db.Save(&device)

	// Create assessment record with empty metrics
	newAssessment := models.Assessment{
		UserEmail:       assessment.UserEmail,
		DeviceID:        assessment.DeviceID,
		Date:            time.Now(),
		SubmittedAt:     time.Now(),
		Responses:       assessment.Responses,
		Metrics:         models.JSON{}, // Initialize empty
		QuestionMetrics: models.JSON{}, // Initialize empty
	}

	// Process metadata if available
	if assessment.Metadata != nil {
		var metadata map[string]interface{}
		if err := json.Unmarshal(assessment.Metadata, &metadata); err != nil {
			r.log.Warnw("Invalid metadata JSON", "error", err)
		} else {
			// Store global metrics
			if metricData, ok := metadata["interaction_metrics"].(map[string]interface{}); ok {
				newAssessment.Metrics = models.JSON(metricData)
			}

			// Store question-specific metrics - convert properly to models.JSON
			if qMetrics, ok := metadata["question_metrics"].(map[string]interface{}); ok {
				newAssessment.QuestionMetrics = models.JSON(qMetrics)
			}
		}
	}

	// Convert the original submission to raw data for auditing/debugging
	rawDataBytes, err := json.Marshal(assessment)
	if err == nil {
		var rawData models.JSON
		_ = json.Unmarshal(rawDataBytes, &rawData)
		newAssessment.RawData = rawData
	}

	// Save to database
	result = r.db.Create(&newAssessment)
	if result.Error != nil {
		return 0, result.Error
	}

	// Now create the structured metrics
	if err := r.extractAndSaveMetrics(newAssessment.ID, newAssessment.Metrics, newAssessment.QuestionMetrics); err != nil {
		r.log.Warnw("Error saving structured metrics", "error", err)
		// Don't fail the entire operation if this fails
	}

	r.log.Infow("Assessment created successfully",
		"id", newAssessment.ID,
		"user", assessment.UserEmail,
		"device", assessment.DeviceID,
		"responses_count", len(assessment.Responses),
		"has_metrics", len(newAssessment.Metrics) > 0,
		"has_question_metrics", len(newAssessment.QuestionMetrics) > 0)

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

// GetAssessmentsByUser retrieves assessments for a user
func (r *Repository) GetAssessmentsByUser(userID string, skip, limit int) ([]models.AssessmentSummary, error) {
	var assessments []models.Assessment

	query := r.db.Where("user_email = ?", userID).
		Order("date DESC").
		Offset(skip).
		Limit(limit)

	result := query.Find(&assessments)
	if result.Error != nil {
		return nil, result.Error
	}

	// Convert to summary format
	summaries := make([]models.AssessmentSummary, len(assessments))
	for i, assessment := range assessments {
		summary := models.AssessmentSummary{
			ID:              assessment.ID,
			Date:            assessment.Date,
			Responses:       assessment.Responses,
			QuestionMetrics: assessment.QuestionMetrics,
			RawData:         assessment.RawData,
		}

		// Extract metrics from the Metrics JSON field
		if len(assessment.Metrics) > 0 {
			// Copy all metrics to the InteractionMetrics struct
			metricsData := assessment.Metrics

			// Check for specific metrics and assign them
			if clickPrecision, ok := getFloat64FromJSON(metricsData, "clickPrecision"); ok {
				summary.InteractionMetrics.ClickPrecision = clickPrecision
			}
			if pathEfficiency, ok := getFloat64FromJSON(metricsData, "pathEfficiency"); ok {
				summary.InteractionMetrics.PathEfficiency = pathEfficiency
			}
			if overShootRate, ok := getFloat64FromJSON(metricsData, "overShootRate"); ok {
				summary.InteractionMetrics.OvershootRate = overShootRate
			}
			if avgVelocity, ok := getFloat64FromJSON(metricsData, "averageVelocity"); ok {
				summary.InteractionMetrics.AverageVelocity = avgVelocity
			}
			if velVariability, ok := getFloat64FromJSON(metricsData, "velocityVariability"); ok {
				summary.InteractionMetrics.VelocityVariability = velVariability
			}
		}

		summaries[i] = summary
	}

	return summaries, nil
}
