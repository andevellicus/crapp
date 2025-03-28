package repository

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/andevellicus/crapp/internal/models"
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

// MetricsData contains pre-processed metrics data for visualization
type MetricsData struct {
	SymptomName  string                 `json:"symptom_name"`
	MetricName   string                 `json:"metric_name"`
	Timeline     []TimelineDataPoint    `json:"timeline"`
	Correlation  []CorrelationDataPoint `json:"correlation"`
	SymptomScale map[string]interface{} `json:"symptom_scale"`
	MetricMinMax map[string]float64     `json:"metric_min_max"`
}

// GetMetricsCorrelation gets correlation data from structured tables
func (r *Repository) GetMetricsCorrelation(userID, symptomKey, metricKey string) ([]CorrelationDataPoint, error) {
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
func (r *Repository) GetMetricsTimeline(userID, symptomKey, metricKey string) ([]TimelineDataPoint, error) {
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

// GetMetricsForQuestion retrieves all metrics for a specific question
func (r *Repository) GetMetricsForQuestion(questionID string) ([]models.AssessmentMetric, error) {
	var metrics []models.AssessmentMetric
	err := r.db.Where("question_id = ?", questionID).Find(&metrics).Error
	return metrics, err
}

// GetMetricTimeline retrieves a timeline of a specific metric for a question
func (r *Repository) GetMetricTimeline(userID, questionID, metricKey string) ([]struct {
	Date        time.Time `json:"date"`
	MetricValue float64   `json:"metric_value"`
}, error) {
	var results []struct {
		Date        time.Time `json:"date"`
		MetricValue float64   `json:"metric_value"`
	}

	// Join with assessments table to get the date and filter by user
	err := r.db.Table("assessment_metrics").
		Select("assessments.date, assessment_metrics.metric_value").
		Joins("JOIN assessments ON assessment_metrics.assessment_id = assessments.id").
		Where("assessments.user_email = ? AND assessment_metrics.question_id = ? AND assessment_metrics.metric_key = ?",
			userID, questionID, metricKey).
		Order("assessments.date ASC").
		Find(&results).Error

	return results, err
}

// GetCorrelationData retrieves symptom value and metric value pairs for correlation analysis
func (r *Repository) GetCorrelationData(userID, symptomKey, metricKey string) ([]struct {
	SymptomValue float64 `json:"symptom_value"`
	MetricValue  float64 `json:"metric_value"`
}, error) {
	var results []struct {
		SymptomValue float64 `json:"symptom_value"`
		MetricValue  float64 `json:"metric_value"`
	}

	// Form the proper JSON path for SQLite
	// This extracts the symptom value from the responses JSON field
	jsonPath := "$." + symptomKey

	// Get the data with a proper JSON extraction
	err := r.db.Raw(`
        SELECT 
            CAST(json_extract(assessments.responses, ?) AS REAL) AS symptom_value,
            assessment_metrics.metric_value
        FROM assessment_metrics
        JOIN assessments ON assessment_metrics.assessment_id = assessments.id
        WHERE assessments.user_email = ?
            AND assessment_metrics.question_id = ?
            AND assessment_metrics.metric_key = ?
            AND json_extract(assessments.responses, ?) IS NOT NULL
    `, jsonPath, userID, symptomKey, metricKey, jsonPath).Find(&results).Error

	return results, err
}

// Add a new function to handle the extraction and saving of metrics
func (r *Repository) extractAndSaveMetrics(assessmentID uint, metadata json.RawMessage) error {
	// Parse the metadata
	var metadataMap map[string]interface{}
	if err := json.Unmarshal(metadata, &metadataMap); err != nil {
		return fmt.Errorf("failed to parse metadata: %w", err)
	}

	metrics := make([]*models.AssessmentMetric, 0)

	// Process global metrics (interaction_metrics)
	if interactionMetrics, ok := metadataMap["interaction_metrics"].(map[string]interface{}); ok {
		for metricKey, metricValue := range interactionMetrics {
			// Handle metric result objects
			if metricObj, ok := metricValue.(map[string]interface{}); ok {
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
	if questionMetrics, ok := metadataMap["question_metrics"].(map[string]interface{}); ok {
		for questionID, qData := range questionMetrics {
			if qMetrics, ok := qData.(map[string]interface{}); ok {
				for metricKey, metricValue := range qMetrics {
					if metricObj, ok := metricValue.(map[string]interface{}); ok {
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
