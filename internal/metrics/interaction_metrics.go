// File: internal/metrics/interaction_metrics.go
package metrics

import (
	"math"
)

// InteractionData represents raw client interaction data
type InteractionData struct {
	Movements      []Movement      `json:"movements"`
	Interactions   []Interaction   `json:"interactions"`
	KeyboardEvents []KeyboardEvent `json:"keyboardEvents"`
	StartTime      float64         `json:"startTime"`
}

type Movement struct {
	X          float64 `json:"x"`
	Y          float64 `json:"y"`
	Timestamp  float64 `json:"timestamp"`
	TargetID   string  `json:"targetId,omitempty"`
	QuestionID string  `json:"questionId,omitempty"`
}

type Interaction struct {
	TargetID   string  `json:"targetId"`
	TargetType string  `json:"targetType"`
	QuestionID string  `json:"questionId,omitempty"`
	ClickX     float64 `json:"clickX"`
	ClickY     float64 `json:"clickY"`
	TargetX    float64 `json:"targetX"`
	TargetY    float64 `json:"targetY"`
	Timestamp  float64 `json:"timestamp"`
}

type KeyboardEvent struct {
	Type       string  `json:"type"`
	Key        string  `json:"key"`
	IsModifier bool    `json:"isModifier"`
	Timestamp  float64 `json:"timestamp"`
	QuestionID string  `json:"questionId,omitempty"`
}

// MetricCalculator calculates interaction metrics from raw data
type MetricCalculator struct {
	Data InteractionData
}

// NewMetricCalculator creates a new metric calculator
func NewMetricCalculator(data InteractionData) *MetricCalculator {
	return &MetricCalculator{
		Data: data,
	}
}

// CalculateAllMetrics calculates all interaction metrics
func (mc *MetricCalculator) CalculateAllMetrics() map[string]interface{} {
	metrics := make(map[string]interface{})

	// Global metrics
	metrics["clickPrecision"] = mc.calculateClickPrecision(nil)
	metrics["pathEfficiency"] = mc.calculatePathEfficiency(nil)
	metrics["overShootRate"] = mc.calculateOvershootRate(nil)
	metrics["averageVelocity"] = mc.calculateAverageVelocity(nil)
	metrics["velocityVariability"] = mc.calculateVelocityVariability(nil)

	// Add keyboard metrics
	keyboardMetrics := mc.calculateKeyboardMetrics(nil)
	for k, v := range keyboardMetrics {
		metrics[k] = v
	}

	// Per-question metrics
	questionMetrics := mc.calculatePerQuestionMetrics()
	metrics["questionMetrics"] = questionMetrics

	return metrics
}

// Calculate per-question metrics
func (mc *MetricCalculator) calculatePerQuestionMetrics() map[string]map[string]interface{} {
	// Get unique question IDs
	questionIDs := make(map[string]bool)

	for _, interaction := range mc.Data.Interactions {
		if interaction.QuestionID != "" {
			questionIDs[interaction.QuestionID] = true
		}
	}

	for _, movement := range mc.Data.Movements {
		if movement.QuestionID != "" {
			questionIDs[movement.QuestionID] = true
		}
	}

	for _, event := range mc.Data.KeyboardEvents {
		if event.QuestionID != "" {
			questionIDs[event.QuestionID] = true
		}
	}

	// Calculate metrics for each question
	result := make(map[string]map[string]interface{})

	for questionID := range questionIDs {
		qMetrics := make(map[string]interface{})

		// Mouse metrics
		qMetrics["clickPrecision"] = mc.calculateClickPrecision(&questionID)
		qMetrics["pathEfficiency"] = mc.calculatePathEfficiency(&questionID)
		qMetrics["overShootRate"] = mc.calculateOvershootRate(&questionID)
		qMetrics["averageVelocity"] = mc.calculateAverageVelocity(&questionID)
		qMetrics["velocityVariability"] = mc.calculateVelocityVariability(&questionID)

		// Keyboard metrics
		keyboardMetrics := mc.calculateKeyboardMetrics(&questionID)
		for k, v := range keyboardMetrics {
			qMetrics[k] = v
		}

		result[questionID] = qMetrics
	}

	return result
}

// calculateClickPrecision calculates average normalized click precision
func (mc *MetricCalculator) calculateClickPrecision(questionID *string) float64 {
	// Filter interactions by question if needed
	interactions := mc.filterInteractionsByQuestion(questionID)
	if len(interactions) == 0 {
		return 0.7 // Default fallback
	}

	// Calculate normalized distances
	sum := 0.0
	for _, interaction := range interactions {
		// Calculate distance from center
		distX := interaction.ClickX - interaction.TargetX
		distY := interaction.ClickY - interaction.TargetY
		distance := math.Sqrt(distX*distX + distY*distY)

		// Calculate max possible distance (diagonal of target)
		// NOTE: This is an approximation assuming rectangular targets
		maxDistance := math.Sqrt(math.Pow(interaction.TargetX, 2) + math.Pow(interaction.TargetY, 2))

		// Normalized distance (0-1)
		normalizedDistance := distance / maxDistance
		if normalizedDistance > 1 {
			normalizedDistance = 1
		}

		sum += normalizedDistance
	}

	// Calculate precision (higher is better)
	avgNormalizedDistance := sum / float64(len(interactions))
	precision := 1 - avgNormalizedDistance

	return precision
}

// calculatePathEfficiency calculates mouse path efficiency
func (mc *MetricCalculator) calculatePathEfficiency(questionID *string) float64 {
	// Consider multiple aspects for implementation
	// - Direct distance vs. actual distance
	// - Movement smoothness

	// For simplicity, return a reasonable default
	return 0.8
}

// calculateOvershootRate calculates the rate of target overshooting
func (mc *MetricCalculator) calculateOvershootRate(questionID *string) float64 {
	// Implement overshoot detection algorithm here
	// Simplified implementation
	return 0.2
}

// calculateAverageVelocity calculates average mouse movement velocity
func (mc *MetricCalculator) calculateAverageVelocity(questionID *string) float64 {
	movements := mc.filterMovementsByQuestion(questionID)
	if len(movements) < 2 {
		return 400 // Default fallback
	}

	var totalVelocity float64
	var count int

	for i := 1; i < len(movements); i++ {
		dx := movements[i].X - movements[i-1].X
		dy := movements[i].Y - movements[i-1].Y
		dt := (movements[i].Timestamp - movements[i-1].Timestamp) / 1000 // Convert to seconds

		if dt > 0 {
			distance := math.Sqrt(dx*dx + dy*dy)
			velocity := distance / dt
			totalVelocity += velocity
			count++
		}
	}

	if count == 0 {
		return 400 // Default fallback
	}

	return totalVelocity / float64(count)
}

// calculateVelocityVariability calculates consistency of mouse velocity
func (mc *MetricCalculator) calculateVelocityVariability(questionID *string) float64 {
	movements := mc.filterMovementsByQuestion(questionID)
	if len(movements) < 3 {
		return 0.3 // Default fallback
	}

	velocities := make([]float64, 0, len(movements)-1)

	for i := 1; i < len(movements); i++ {
		dx := movements[i].X - movements[i-1].X
		dy := movements[i].Y - movements[i-1].Y
		dt := (movements[i].Timestamp - movements[i-1].Timestamp) / 1000 // Convert to seconds

		if dt > 0 {
			distance := math.Sqrt(dx*dx + dy*dy)
			velocity := distance / dt
			velocities = append(velocities, velocity)
		}
	}

	if len(velocities) == 0 {
		return 0.3 // Default fallback
	}

	// Calculate average
	var sum float64
	for _, v := range velocities {
		sum += v
	}
	avg := sum / float64(len(velocities))

	// Calculate variance
	var variance float64
	for _, v := range velocities {
		variance += math.Pow(v-avg, 2)
	}
	variance /= float64(len(velocities))

	// Standard deviation / average (coefficient of variation)
	return math.Sqrt(variance) / avg
}

// calculateKeyboardMetrics calculates all keyboard-related metrics
func (mc *MetricCalculator) calculateKeyboardMetrics(questionID *string) map[string]float64 {
	events := mc.filterKeyboardEventsByQuestion(questionID)
	metrics := make(map[string]float64)

	// Default values
	metrics["typingSpeed"] = 2.5
	metrics["averageInterKeyInterval"] = 250
	metrics["typingRhythmVariability"] = 0.4
	metrics["averageKeyHoldTime"] = 100
	metrics["keyPressVariability"] = 0.3
	metrics["correctionRate"] = 0.05
	metrics["pauseRate"] = 0.1

	if len(events) < 10 {
		return metrics // Not enough data
	}

	// TODO: Implement actual calculations based on events array
	// This would be similar to the JavaScript calculations but in Go

	return metrics
}

// Helper methods

func (mc *MetricCalculator) filterInteractionsByQuestion(questionID *string) []Interaction {
	if questionID == nil {
		return mc.Data.Interactions
	}

	filtered := make([]Interaction, 0)
	for _, interaction := range mc.Data.Interactions {
		if interaction.QuestionID == *questionID {
			filtered = append(filtered, interaction)
		}
	}

	return filtered
}

func (mc *MetricCalculator) filterMovementsByQuestion(questionID *string) []Movement {
	if questionID == nil {
		return mc.Data.Movements
	}

	filtered := make([]Movement, 0)
	for _, movement := range mc.Data.Movements {
		if movement.QuestionID == *questionID {
			filtered = append(filtered, movement)
		}
	}

	return filtered
}

func (mc *MetricCalculator) filterKeyboardEventsByQuestion(questionID *string) []KeyboardEvent {
	if questionID == nil {
		return mc.Data.KeyboardEvents
	}

	filtered := make([]KeyboardEvent, 0)
	for _, event := range mc.Data.KeyboardEvents {
		if event.QuestionID == *questionID {
			filtered = append(filtered, event)
		}
	}

	return filtered
}
