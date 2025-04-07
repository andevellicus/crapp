package metrics

import (
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

/*
// MetricCalculator calculates interaction metrics from raw data
type MetricCalculator struct {
	InteractionData *InteractionData
	CPTData         *CPTData
}
*/

// MetricResult represents a calculated metric with status and metadata
type MetricResult struct {
	Value      float64 `json:"value"`
	Calculated bool    `json:"calculated"`
	SampleSize int     `json:"sampleSize,omitempty"`
}

type CalculatedMetrics struct {
	// Global metrics (for entire assessment)
	GlobalMetrics []models.AssessmentMetric

	// Per-question metrics
	QuestionMetrics []models.AssessmentMetric
}

// CalculateInteractionMetrics calculates all interaction metrics
func CalculateInteractionMetrics(interactions *InteractionData) *CalculatedMetrics {
	result := &CalculatedMetrics{
		GlobalMetrics:   []models.AssessmentMetric{},
		QuestionMetrics: []models.AssessmentMetric{},
	}

	// Get global mouse metrics
	globalMetrics := map[string]MetricResult{
		"click_precision":      calculateClickPrecision(nil, interactions),
		"path_efficiency":      calculatePathEfficiency(nil, interactions),
		"overshoot_rate":       calculateOvershootRate(nil, interactions),
		"average_velocity":     calculateAverageVelocity(nil, interactions),
		"velocity_variability": calculateVelocityVariability(nil, interactions),
	}

	// Add keyboard metrics
	keyboardMetrics := calculateKeyboardMetrics(nil, interactions)
	for k, v := range keyboardMetrics {
		globalMetrics[k] = v
	}

	// Convert global metrics to AssessmentMetric models
	for metricKey, metricResult := range globalMetrics {
		if metricResult.Calculated {
			result.GlobalMetrics = append(result.GlobalMetrics, models.AssessmentMetric{
				QuestionID:  "global",
				MetricKey:   metricKey,
				MetricValue: metricResult.Value,
				SampleSize:  metricResult.SampleSize,
				CreatedAt:   time.Now(),
			})
		}
	}

	// Calculate per-question metrics
	questionMetricsMap := calculatePerQuestionMetrics(interactions)

	// Convert question metrics to AssessmentMetric models
	for questionID, metricsMap := range questionMetricsMap {
		for metricKey, metricResult := range metricsMap {
			if metricResult.Calculated {
				result.QuestionMetrics = append(result.QuestionMetrics, models.AssessmentMetric{
					QuestionID:  questionID,
					MetricKey:   metricKey,
					MetricValue: metricResult.Value,
					SampleSize:  metricResult.SampleSize,
					CreatedAt:   time.Now(),
				})
			}
		}
	}

	return result
}

func CalculateCPTMetrics(results *CPTData) *models.CPTResult {
	// Create CPT result model with all fields properly populated
	return &models.CPTResult{
		// These fields will be set by the handler
		// UserEmail, DeviceID, AssessmentID

		// Time fields
		TestStartTime: time.Unix(0, int64(results.TestStartTime)*int64(time.Millisecond)),
		TestEndTime:   time.Unix(0, int64(results.TestEndTime)*int64(time.Millisecond)),

		// Performance metrics
		CorrectDetections:   countCorrectDetections(results),
		CommissionErrors:    countCommissionErrors(results),
		OmissionErrors:      countOmissionErrors(results),
		AverageReactionTime: calculateAverageReactionTime(results),
		ReactionTimeSD:      calculateReactionTimeSD(results),
		DetectionRate:       calculateDetectionRate(results),
		OmissionErrorRate:   calculateOmissionErrorRate(results),
		CommissionErrorRate: calculateCommissionErrorRate(results),

		// Store the raw data for future analysis
		RawData:   serializeCPTData(results),
		CreatedAt: time.Now(),
	}
}
