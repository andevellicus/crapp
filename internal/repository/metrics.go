package repository

import (
	"fmt"
	"strconv"
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

// GetMetricsCorrelation gets correlation data for a specific symptom and metric
func (r *Repository) GetMetricsCorrelation(userID, symptomKey, metricKey string) ([]CorrelationDataPoint, error) {
	var assessments []models.Assessment
	var result []CorrelationDataPoint

	// Query database for assessments with these keys
	query := r.db.Where("user_email = ?", userID).Order("date DESC")

	if err := query.Find(&assessments).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Process into correlation format
	for _, assessment := range assessments {
		// Extract symptom value
		symptomValue, err1 := getSymptomValue(&assessment, symptomKey)
		// Extract metric value
		metricValue, err2 := getMetricValue(&assessment, metricKey, symptomKey)

		if err1 == nil && err2 == nil && symptomValue != nil && metricValue != nil {
			// Add to result set
			result = append(result, CorrelationDataPoint{
				SymptomValue: *symptomValue,
				MetricValue:  *metricValue,
			})
		}
	}

	// Log the results
	r.log.Infow("Generated correlation data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result),
		"result", result)

	return result, nil
}

// GetMetricsTimeline gets timeline data for a specific symptom and metric
func (r *Repository) GetMetricsTimeline(userID, symptomKey, metricKey string) ([]TimelineDataPoint, error) {
	var assessments []models.Assessment
	var result []TimelineDataPoint

	// Query database for assessments with these keys
	query := r.db.Where("user_email = ?", userID).Order("date ASC")

	if err := query.Find(&assessments).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}

	// Process into timeline format
	for _, assessment := range assessments {
		// Extract symptom value
		symptomValue, err1 := getSymptomValue(&assessment, symptomKey)
		// Extract metric value
		metricValue, err2 := getMetricValue(&assessment, metricKey, symptomKey)

		if err1 == nil && err2 == nil && symptomValue != nil && metricValue != nil {
			result = append(result, TimelineDataPoint{
				Date:         assessment.Date,
				SymptomValue: *symptomValue,
				MetricValue:  *metricValue,
			})
		}
	}

	r.log.Infow("Generated timeline data",
		"user_id", userID,
		"symptom", symptomKey,
		"metric", metricKey,
		"points_count", len(result))

	return result, nil
}

// GetMetricsData gets all visualization data in one call
func (r *Repository) GetMetricsData(userID, symptomKey, metricKey string) (*MetricsData, error) {
	// Get correlation data
	correlation, err := r.GetMetricsCorrelation(userID, symptomKey, metricKey)
	if err != nil {
		return nil, err
	}

	// Get timeline data
	timeline, err := r.GetMetricsTimeline(userID, symptomKey, metricKey)
	if err != nil {
		return nil, err
	}

	// Load question info to get scale
	// This would require accessing the QuestionLoader
	// For now, use a default scale
	symptomScale := map[string]interface{}{
		"min":  0,
		"max":  3,
		"step": 1,
	}

	// Calculate metric min/max for proper scaling
	metricMin, metricMax := 0.0, 0.0
	if len(correlation) > 0 {
		metricMin = correlation[0].MetricValue
		metricMax = correlation[0].MetricValue

		for _, point := range correlation {
			if point.MetricValue < metricMin {
				metricMin = point.MetricValue
			}
			if point.MetricValue > metricMax {
				metricMax = point.MetricValue
			}
		}
	}

	return &MetricsData{
		SymptomName:  symptomKey,
		MetricName:   metricKey,
		Timeline:     timeline,
		Correlation:  correlation,
		SymptomScale: symptomScale,
		MetricMinMax: map[string]float64{
			"min": metricMin,
			"max": metricMax,
		},
	}, nil
}

func (r *Repository) CreateAssessmentMetrics(assessmentID uint, questionMetrics map[string]map[string]interface{}, globalMetrics map[string]interface{}) error {
	metrics := make([]*models.AssessmentMetric, 0)

	// Process question-specific metrics
	for questionID, questionData := range questionMetrics {
		for metricKey, metricDataRaw := range questionData {
			// Try to extract metric result
			if metricData, ok := metricDataRaw.(map[string]interface{}); ok {
				// Check if it's calculated
				if calculated, cOk := metricData["calculated"].(bool); cOk && calculated {
					value, vOk := metricData["value"].(float64)
					sampleSize := 0
					if s, sOk := metricData["sampleSize"].(float64); sOk {
						sampleSize = int(s)
					}

					if vOk {
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
			} else if value, ok := metricDataRaw.(float64); ok {
				// Direct value (simplified case)
				metrics = append(metrics, &models.AssessmentMetric{
					AssessmentID: assessmentID,
					QuestionID:   questionID,
					MetricKey:    metricKey,
					MetricValue:  value,
					SampleSize:   0, // Unknown sample size for direct values
					CreatedAt:    time.Now(),
				})
			}
		}
	}

	// Process global metrics (use empty string as questionID)
	for metricKey, metricDataRaw := range globalMetrics {
		// Try to extract metric result
		if metricData, ok := metricDataRaw.(map[string]interface{}); ok {
			// Check if it's calculated
			if calculated, cOk := metricData["calculated"].(bool); cOk && calculated {
				value, vOk := metricData["value"].(float64)
				sampleSize := 0
				if s, sOk := metricData["sampleSize"].(float64); sOk {
					sampleSize = int(s)
				}

				if vOk {
					metrics = append(metrics, &models.AssessmentMetric{
						AssessmentID: assessmentID,
						QuestionID:   "", // Empty string for global metrics
						MetricKey:    metricKey,
						MetricValue:  value,
						SampleSize:   sampleSize,
						CreatedAt:    time.Now(),
					})
				}
			}
		} else if value, ok := metricDataRaw.(float64); ok {
			// Direct value (simplified case)
			metrics = append(metrics, &models.AssessmentMetric{
				AssessmentID: assessmentID,
				QuestionID:   "", // Empty string for global metrics
				MetricKey:    metricKey,
				MetricValue:  value,
				SampleSize:   0, // Unknown sample size for direct values
				CreatedAt:    time.Now(),
			})
		}
	}

	// Save all metrics in bulk
	if len(metrics) > 0 {
		return r.db.CreateInBatches(metrics, 100).Error
	}

	return nil
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

// getSymptomValue extracts a symptom value from an assessment
func getSymptomValue(assessment *models.Assessment, symptomKey string) (*float64, error) {
	// Try to get from responses object (new format)
	if assessment.Responses != nil {
		if val, ok := assessment.Responses[symptomKey]; ok {
			// Handle different value types (could be string, number, etc.)
			switch v := val.(type) {
			case float64:
				return &v, nil
			case int:
				f := float64(v)
				return &f, nil
			case string:
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					return &f, nil
				}
			}
		}
	}

	// Try legacy format (if symptom data is structured differently)
	if rawData, ok := assessment.RawData["responses"].(map[string]interface{}); ok {
		if val, ok := rawData[symptomKey]; ok {
			// Handle different value types
			switch v := val.(type) {
			case float64:
				return &v, nil
			case int:
				f := float64(v)
				return &f, nil
			case string:
				if f, err := strconv.ParseFloat(v, 64); err == nil {
					return &f, nil
				}
			}
		}
	}

	return nil, fmt.Errorf("symptom value not found for key: %s", symptomKey)
}

func getMetricValue(assessment *models.Assessment, metricKey, symptomKey string) (*float64, error) {
	// Convert metric key to camelCase for alternate format checking
	camelCaseKey := toCamelCase(metricKey)

	// Define locations to check with ordered priority
	sources := []struct {
		name      string
		container map[string]interface{}
	}{
		// Try question-specific metrics first
		{"questionMetrics", getNestedMap(assessment.QuestionMetrics, symptomKey)},

		// Then try metrics field for any value
		{"metrics", assessment.Metrics},

		// Then try raw data fields
		{"rawQuestionMetrics", getNestedMap(
			getNestedMap(getNestedMap(assessment.RawData, "metadata"), "question_metrics"),
			symptomKey),
		},
		{"rawInteractionMetrics", getNestedMap(
			getNestedMap(assessment.RawData, "metadata"),
			"interaction_metrics"),
		},
	}

	// Check each location for both key variants
	for _, source := range sources {
		if source.container != nil {
			// Check original key
			if val, ok := source.container[metricKey]; ok {
				return extractFloat64Value(val)
			}

			// Check camelCase variant
			if val, ok := source.container[camelCaseKey]; ok {
				return extractFloat64Value(val)
			}
		}
	}

	return nil, fmt.Errorf("metric value not found for key: %s in question: %s", metricKey, symptomKey)
}

// Add a new function to handle the extraction and saving of metrics
func (r *Repository) extractAndSaveMetrics(assessmentID uint, globalMetrics, questionMetrics models.JSON) error {
	metrics := make([]*models.AssessmentMetric, 0)

	// Process global metrics
	for metricKey, metricValue := range globalMetrics {
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

	// Process question metrics
	for questionID, qData := range questionMetrics {
		if questionMetrics, ok := qData.(map[string]interface{}); ok {
			for metricKey, metricValue := range questionMetrics {
				// Process similar to global metrics
				if metricObj, ok := metricValue.(map[string]interface{}); ok {
					if calculated, cOk := metricObj["calculated"].(bool); cOk && calculated {
						if value, vOk := metricObj["value"].(float64); vOk {
							// Add to structured metrics
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

	// Save metrics in batches if we have any
	if len(metrics) > 0 {
		return r.db.CreateInBatches(metrics, 100).Error
	}

	return nil
}
