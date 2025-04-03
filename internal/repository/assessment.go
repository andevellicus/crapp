package repository

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/andevellicus/crapp/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// TimelineDataPoint represents a single point in a metrics timeline
type TimelineDataPoint struct {
	Date         time.Time `json:"date"`
	SymptomValue float64   `json:"symptom_value"`
	MetricValue  float64   `json:"metric_value"`
}

// CorrelationDataPoint represents a single point for correlation analysis
type CorrelationDataPoint struct {
	SymptomValue float64 `json:"symptom_value"`
	MetricValue  float64 `json:"metric_value"`
}

// MetricsData contains pre-processed metrics data for charts
type MetricsData struct {
	SymptomName  string                 `json:"symptom_name"`
	MetricName   string                 `json:"metric_name"`
	Timeline     []TimelineDataPoint    `json:"timeline"`
	Correlation  []CorrelationDataPoint `json:"correlation"`
	SymptomScale map[string]any         `json:"symptom_scale"`
	MetricMinMax map[string]float64     `json:"metric_min_max"`
}

// UserRepository extends the generic repository with user-specific methods
type AssessmentRepository struct {
	db       *gorm.DB
	log      *zap.SugaredLogger
	userRepo UserDB
}

// NewAssessmentRepository creates a new assessment repository
func NewAssessmentRepository(db *gorm.DB, log *zap.SugaredLogger, userRepo UserDB) AsessmentDB {
	return &AssessmentRepository{
		db:       db,
		log:      log.Named("assessment-repo"),
		userRepo: userRepo,
	}
}

// CreateAssessment creates a new assessment with structured data
func (r *AssessmentRepository) Create(assessment *models.AssessmentSubmission) (uint, error) {
	log := r.log.With(
		"operation", "CreateAssessment",
		"userEmail", assessment.UserEmail,
		"deviceID", assessment.DeviceID,
	)

	// Check if user exists using the User repository
	exists, err := r.userRepo.UserExists(assessment.UserEmail)
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
		log.Errorw("Database error finding device", "error", result.Error)
		return 0, fmt.Errorf("device not found or doesn't belong to user: %w", result.Error)
	}

	// Update device last active time
	device.LastActive = time.Now()
	r.db.Save(&device)

	// Create assessment record - JSON fields stay for reference but aren't used for charts
	newAssessment := models.Assessment{
		UserEmail:   assessment.UserEmail,
		DeviceID:    assessment.DeviceID,
		Date:        time.Now(),
		SubmittedAt: time.Now(),
		Responses:   assessment.Responses, // Keep JSON copy for reference
	}

	// Save to database
	if err := r.db.Create(&newAssessment).Error; err != nil {
		return 0, err
	}

	// Now save structured responses
	if err := r.saveStructuredResponses(newAssessment.ID, assessment.Responses); err != nil {
		log.Warnw("Error saving structured responses", "error", err)
		// Don't fail the entire operation
	}

	// Save structured metrics if metadata available
	if assessment.Metadata != nil {
		if err := r.extractAndSaveMetrics(newAssessment.ID, assessment.Metadata); err != nil {
			log.Warnw("Error saving structured metrics", "error", err)
			// Don't fail the entire operation
		}
	}

	return newAssessment.ID, nil
}

// GetMetricsCorrelation gets correlation data from structured tables
func (r *AssessmentRepository) GetMetricsCorrelation(userID, symptomKey, metricKey string) ([]CorrelationDataPoint, error) {
	var result []CorrelationDataPoint

	// Use a different JOIN approach - first get the response data, then match metrics
	query := `
        SELECT 
            qr.numeric_value as symptom_value,
            am.metric_value
        FROM 
            assessments a
            JOIN question_responses qr ON a.id = qr.assessment_id
            JOIN assessment_metrics am ON a.id = am.assessment_id
        WHERE 
            a.user_email = ?
            AND qr.question_id = ?
            AND am.metric_key = ?
            AND am.question_id = ?
    `

	err := r.db.Raw(query, userID, symptomKey, metricKey, symptomKey).Scan(&result).Error
	if err != nil {
		r.log.Errorw("Error in correlation query", "error", err)
		return nil, fmt.Errorf("database error: %w", err)
	}

	r.log.Infow("Retrieved correlation data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result))

	return result, nil
}

// GetMetricsTimeline gets timeline data from structured tables
func (r *AssessmentRepository) GetMetricsTimeline(userID, symptomKey, metricKey string) ([]TimelineDataPoint, error) {
	var result []TimelineDataPoint

	// Use a different JOIN approach and debugging
	query := `
        SELECT 
            a.date,
            qr.numeric_value as symptom_value,
            am.metric_value
        FROM 
            assessments a
            JOIN question_responses qr ON a.id = qr.assessment_id
            JOIN assessment_metrics am ON a.id = am.assessment_id
        WHERE 
            a.user_email = ?
            AND qr.question_id = ?
            AND am.metric_key = ?
            AND am.question_id = ?
        ORDER BY a.date ASC
    `

	err := r.db.Raw(query, userID, symptomKey, metricKey, symptomKey).Scan(&result).Error
	if err != nil {
		r.log.Errorw("Error in timeline query", "error", err)
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Log the results for debugging
	r.log.Infow("Retrieved timeline data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result))

	return result, nil
}

// Save structured responses
func (r *AssessmentRepository) saveStructuredResponses(assessmentID uint, responses models.JSON) error {
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

// Add a new function to handle the extraction and saving of metrics
func (r *AssessmentRepository) extractAndSaveMetrics(assessmentID uint, metadata json.RawMessage) error {
	// Parse the metadata
	var metadataMap map[string]any
	if err := json.Unmarshal(metadata, &metadataMap); err != nil {
		return fmt.Errorf("failed to parse metadata: %w", err)
	}

	metrics := make([]*models.AssessmentMetric, 0)

	// Process global metrics (interaction_metrics)
	if interactionMetrics, ok := metadataMap["interaction_metrics"].(map[string]any); ok {
		for metricKey, metricValue := range interactionMetrics {
			// Handle metric result objects
			if metricObj, ok := metricValue.(map[string]any); ok {
				if calculated, cOk := metricObj["calculated"].(bool); cOk && calculated {
					if value, vOk := metricObj["value"].(float64); vOk {
						sampleSize := 0
						if s, sok := metricObj["sampleSize"].(float64); sok {
							sampleSize = int(s)
						}

						metrics = append(metrics, &models.AssessmentMetric{
							AssessmentID: assessmentID,
							QuestionID:   "", // Empty for global metrics
							MetricKey:    metricKey,
							MetricValue:  value,
							SampleSize:   sampleSize,
							CreatedAt:    time.Now(),
						})
					}
				}
			} else if value, ok := metricValue.(float64); ok {
				// Direct numeric value
				metrics = append(metrics, &models.AssessmentMetric{
					AssessmentID: assessmentID,
					QuestionID:   "",
					MetricKey:    metricKey,
					MetricValue:  value,
					SampleSize:   0,
					CreatedAt:    time.Now(),
				})
			}
		}
	}

	// Process question metrics
	if questionMetrics, ok := metadataMap["question_metrics"].(map[string]any); ok {
		for questionID, qData := range questionMetrics {
			if qMetrics, ok := qData.(map[string]any); ok {
				for metricKey, metricValue := range qMetrics {
					if metricObj, ok := metricValue.(map[string]any); ok {
						if calculated, cOk := metricObj["calculated"].(bool); cOk && calculated {
							if value, vOk := metricObj["value"].(float64); vOk {
								sampleSize := 0
								if s, sok := metricObj["sampleSize"].(float64); sok {
									sampleSize = int(s)
								}

								metrics = append(metrics, &models.AssessmentMetric{
									AssessmentID: assessmentID,
									QuestionID:   questionID,
									MetricKey:    metricKey,
									MetricValue:  value,
									SampleSize:   sampleSize,
									CreatedAt:    time.Now(),
								})
							}
						}
					} else if value, ok := metricValue.(float64); ok {
						// Direct numeric value
						metrics = append(metrics, &models.AssessmentMetric{
							AssessmentID: assessmentID,
							QuestionID:   questionID,
							MetricKey:    metricKey,
							MetricValue:  value,
							SampleSize:   0,
							CreatedAt:    time.Now(),
						})
					}
				}
			}
		}
	}

	// Save metrics in batches if we have any
	if len(metrics) > 0 {
		return r.db.CreateInBatches(metrics, 100).Error
	}

	return nil
}
