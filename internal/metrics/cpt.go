package metrics

import (
	"encoding/json"
	"math"
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

// Helper methods for CPT calculations
func (mc *MetricCalculator) countCorrectDetections() int {
	count := 0
	for _, response := range mc.CPTData.Responses {
		if response.IsTarget {
			count++
		}
	}
	return count
}

func (mc *MetricCalculator) countCommissionErrors() int {
	count := 0
	for _, response := range mc.CPTData.Responses {
		if !response.IsTarget {
			count++
		}
	}
	return count
}

func (mc *MetricCalculator) countOmissionErrors() int {
	// Count total targets presented
	totalTargets := 0
	for _, stim := range mc.CPTData.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	// Omission errors = targets missed
	return totalTargets - mc.countCorrectDetections()
}

func (mc *MetricCalculator) calculateAverageReactionTime() float64 {
	var sum float64
	var count int

	for _, response := range mc.CPTData.Responses {
		if response.IsTarget {
			sum += response.ResponseTime
			count++
		}
	}

	if count == 0 {
		return 0
	}
	return sum / float64(count)
}

func (mc *MetricCalculator) calculateReactionTimeSD() float64 {
	// Get reaction times and average
	var reactionTimes []float64
	for _, response := range mc.CPTData.Responses {
		if response.IsTarget {
			reactionTimes = append(reactionTimes, response.ResponseTime)
		}
	}

	if len(reactionTimes) <= 1 {
		return 0
	}

	avg := mc.calculateAverageReactionTime()
	var sumSquaredDiff float64

	for _, rt := range reactionTimes {
		diff := rt - avg
		sumSquaredDiff += diff * diff
	}

	variance := sumSquaredDiff / float64(len(reactionTimes))
	return math.Sqrt(variance)
}

func (mc *MetricCalculator) calculateDetectionRate() float64 {
	// Count total targets presented
	totalTargets := 0
	for _, stim := range mc.CPTData.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	if totalTargets == 0 {
		return 0
	}

	return float64(mc.countCorrectDetections()) / float64(totalTargets)
}

func (mc *MetricCalculator) calculateOmissionErrorRate() float64 {
	// Count total targets presented
	totalTargets := 0
	for _, stim := range mc.CPTData.StimuliPresented {
		if stim.IsTarget {
			totalTargets++
		}
	}

	if totalTargets == 0 {
		return 0
	}

	return float64(mc.countOmissionErrors()) / float64(totalTargets)
}

func (mc *MetricCalculator) calculateCommissionErrorRate() float64 {
	// Count non-targets
	nonTargetCount := 0
	for _, stim := range mc.CPTData.StimuliPresented {
		if !stim.IsTarget {
			nonTargetCount++
		}
	}

	if nonTargetCount == 0 {
		return 0
	}

	return float64(mc.countCommissionErrors()) / float64(nonTargetCount)
}

func (mc *MetricCalculator) serializeCPTData() json.RawMessage {
	data, err := json.Marshal(mc.CPTData)
	if err != nil {
		return json.RawMessage("{}")
	}
	return data
}
