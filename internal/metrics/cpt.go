package metrics

import (
	"encoding/json"
	"fmt"
	"math"
	"time"

	"github.com/andevellicus/crapp/internal/models"
)

type CPTStimulusPresentation struct {
	Value       string  `json:"value"`
	IsTarget    bool    `json:"isTarget"`
	PresentedAt float64 `json:"presentedAt"`
}

type CPTResponse struct {
	Stimulus      string  `json:"stimulus"`
	IsTarget      bool    `json:"isTarget"`
	ResponseTime  float64 `json:"responseTime"`
	StimulusIndex int     `json:"stimulusIndex"`
}

// CPTData represents the structure of raw CPT test data
type CPTData struct {
	TestStartTime    float64                   `json:"testStartTime"`
	TestEndTime      float64                   `json:"testEndTime"`
	StimuliPresented []CPTStimulusPresentation `json:"stimuliPresented"`
	Responses        []CPTResponse             `json:"responses"`
	Settings         map[string]any            `json:"settings"`
}

// CalculateCPTMetrics computes all metrics from raw CPT test data
func (mc *MetricCalculator) CalculateCPTMetrics(rawData []byte) (*models.CPTResult, error) {
	// Parse raw data
	var rawResults CPTData
	if err := json.Unmarshal(rawData, &rawResults); err != nil {
		return nil, fmt.Errorf("failed to parse raw data: %w", err)
	}

	// Convert JavaScript timestamps to Go time
	testStartTime := time.Unix(0, int64(rawResults.TestStartTime*float64(time.Millisecond)))
	testEndTime := time.Unix(0, int64(rawResults.TestEndTime*float64(time.Millisecond)))

	// Count target stimuli presented
	totalTargets := 0
	for _, stim := range rawResults.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	// Calculate correct detections, errors, and reaction times
	correctDetections := 0
	commissionErrors := 0
	var reactionTimes []float64

	for _, response := range rawResults.Responses {
		if response.IsTarget {
			correctDetections++
			reactionTimes = append(reactionTimes, response.ResponseTime)
		} else {
			commissionErrors++
		}
	}

	// Calculate omission errors
	omissionErrors := max(totalTargets-correctDetections, 0)

	// Calculate average reaction time
	averageReactionTime := 0.0
	if len(reactionTimes) > 0 {
		sum := 0.0
		for _, rt := range reactionTimes {
			sum += rt
		}
		averageReactionTime = sum / float64(len(reactionTimes))
	}

	// Calculate reaction time standard deviation
	reactionTimeSD := 0.0
	if len(reactionTimes) > 1 {
		sumSquaredDiffs := 0.0
		for _, rt := range reactionTimes {
			diff := rt - averageReactionTime
			sumSquaredDiffs += diff * diff
		}
		reactionTimeSD = math.Sqrt(sumSquaredDiffs / float64(len(reactionTimes)))
	}

	// Calculate rates
	detectionRate := 0.0
	if totalTargets > 0 {
		detectionRate = float64(correctDetections) / float64(totalTargets)
	}

	omissionErrorRate := 0.0
	if totalTargets > 0 {
		omissionErrorRate = float64(omissionErrors) / float64(totalTargets)
	}

	commissionErrorRate := 0.0
	nonTargetCount := len(rawResults.StimuliPresented) - totalTargets
	if nonTargetCount > 0 {
		commissionErrorRate = float64(commissionErrors) / float64(nonTargetCount)
	}

	// Create result object
	result := &models.CPTResult{
		TestStartTime:       testStartTime,
		TestEndTime:         testEndTime,
		CorrectDetections:   correctDetections,
		CommissionErrors:    commissionErrors,
		OmissionErrors:      omissionErrors,
		AverageReactionTime: averageReactionTime,
		ReactionTimeSD:      reactionTimeSD,
		DetectionRate:       detectionRate,
		OmissionErrorRate:   omissionErrorRate,
		CommissionErrorRate: commissionErrorRate,
		RawData:             rawData,
		TestType:            models.CPTest,
		CreatedAt:           time.Now(),
	}

	return result, nil
}

// Calculate correct detections and collect reaction times
func (mc *MetricCalculator) calculateCorrectDetections(data *CPTData) (int, []float64) {
	correctDetections := 0
	var reactionTimes []float64

	for _, response := range data.Responses {
		if response.IsTarget {
			correctDetections++
			reactionTimes = append(reactionTimes, response.ResponseTime)
		}
	}

	return correctDetections, reactionTimes
}

// Calculate omission errors (missed targets)
func (mc *MetricCalculator) calculateOmissionErrors(data *CPTData, correctDetections int) int {
	totalTargets := 0
	for _, stim := range data.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	omissionErrors := totalTargets - correctDetections
	if omissionErrors < 0 {
		omissionErrors = 0 // Safety check
	}

	return omissionErrors
}

// Calculate commission errors (responses to non-targets)
func (mc *MetricCalculator) calculateCommissionErrors(data *CPTData) int {
	commissionErrors := 0

	for _, response := range data.Responses {
		if !response.IsTarget {
			commissionErrors++
		}
	}

	return commissionErrors
}

// Calculate reaction time statistics
func (mc *MetricCalculator) calculateReactionTimeStats(reactionTimes []float64) (float64, float64) {
	if len(reactionTimes) == 0 {
		return 0, 0
	}

	// Calculate average
	sum := 0.0
	for _, rt := range reactionTimes {
		sum += rt
	}
	avg := sum / float64(len(reactionTimes))

	// Calculate standard deviation
	if len(reactionTimes) <= 1 {
		return avg, 0
	}

	sumSquaredDiff := 0.0
	for _, rt := range reactionTimes {
		diff := rt - avg
		sumSquaredDiff += diff * diff
	}
	variance := sumSquaredDiff / float64(len(reactionTimes))
	sd := math.Sqrt(variance)

	return avg, sd
}

// Calculate detection rate
func (mc *MetricCalculator) calculateDetectionRate(data *CPTData, correctDetections int) float64 {
	totalTargets := 0
	for _, stim := range data.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	if totalTargets == 0 {
		return 0
	}

	return float64(correctDetections) / float64(totalTargets)
}

// Calculate omission error rate
func (mc *MetricCalculator) calculateOmissionErrorRate(data *CPTData, omissionErrors int) float64 {
	totalTargets := 0
	for _, stim := range data.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	if totalTargets == 0 {
		return 0
	}

	return float64(omissionErrors) / float64(totalTargets)
}

// Calculate commission error rate
func (mc *MetricCalculator) calculateCommissionErrorRate(data *CPTData, commissionErrors int) float64 {
	nonTargetCount := 0
	for _, stim := range data.StimuliPresented {
		if !stim.IsTarget {
			nonTargetCount++
		}
	}

	if nonTargetCount == 0 {
		return 0
	}

	return float64(commissionErrors) / float64(nonTargetCount)
}
