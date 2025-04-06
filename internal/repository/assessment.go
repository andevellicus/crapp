package repository

import (
	"fmt"
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
	userRepo *UserRepository
}

// NewAssessmentRepository creates a new assessment repository
func NewAssessmentRepository(db *gorm.DB, log *zap.SugaredLogger, userRepo *UserRepository) *AssessmentRepository {
	return &AssessmentRepository{
		db:       db,
		log:      log.Named("assessment-repo"),
		userRepo: userRepo,
	}
}

// CreateAssessment creates a new assessment with structured data
func (r *AssessmentRepository) Create(userEmail string, deviceID string) (uint, error) {
	log := r.log.With(
		"operation", "CreateAssessment",
		"userEmail", userEmail,
		"deviceID", deviceID,
	)

	// Check if user exists using the User repository
	exists, err := r.userRepo.UserExists(userEmail)
	if err != nil {
		return 0, fmt.Errorf("error checking user: %w", err)
	}
	if !exists {
		return 0, fmt.Errorf("user not found: %s", userEmail)
	}

	// Check if device exists and belongs to user
	var device models.Device
	result := r.db.Where("id = ? AND user_email = ?", deviceID, userEmail).First(&device)
	if result.Error != nil {
		log.Errorw("Database error finding device", "error", result.Error)
		return 0, fmt.Errorf("device not found or doesn't belong to user: %w", result.Error)
	}

	// Update device last active time
	device.LastActive = time.Now()
	r.db.Save(&device)

	assessment := &models.Assessment{
		UserEmail:   userEmail,
		DeviceID:    deviceID,
		SubmittedAt: time.Now(),
	}

	// Save to database
	if err := r.db.Create(assessment).Error; err != nil {
		return 0, err
	}

	return assessment.ID, nil
}

// GetMetricsCorrelation gets correlation data from structured tables
func (r *AssessmentRepository) GetMetricsCorrelation(userID, symptomKey, metricKey string) (*[]CorrelationDataPoint, error) {
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

	return &result, nil
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
